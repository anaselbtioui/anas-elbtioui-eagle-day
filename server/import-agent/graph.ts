import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import {
  classifyImport,
  type ExtractedImport,
  type ImportOutcome,
  type ImportSource,
} from '../../src/domain/browser-import.ts'
import type { DeskBundle } from '../../src/domain/desk.ts'
import { planNextAction } from './deepseek.ts'
import { fixtureExtract } from './portals.ts'
import {
  getSession,
  pushStep,
  type ImportSession,
  notify,
  waitForResume,
} from './sessions.ts'
import {
  a11ySnapshot,
  assertAllowlisted,
  closeBrowser,
  heuristicExtract,
  launchPortal,
  safeClick,
  safeType,
} from './tools.ts'

const ImportState = Annotation.Root({
  sessionId: Annotation<string>,
  bundles: Annotation<DeskBundle[]>,
  done: Annotation<boolean>,
})

async function nodeOpen(state: typeof ImportState.State) {
  const session = getSession(state.sessionId)
  if (!session) return { done: true }
  pushStep(session, 'info', 'Ouverture → authentification autorisée → extraction visible → mapping')
  if (session.mode === 'fixture') {
    pushStep(session, 'ok', `Mode fixture · scénario ${session.fixtureOutcome}`)
    return {}
  }
  try {
    session.browser = await launchPortal(session.source)
    pushStep(session, 'ok', `Portail ouvert · ${session.source}`)
    notify(session)
  } catch (err) {
    pushStep(session, 'error', err instanceof Error ? err.message : 'open_failed')
    session.status = 'interrupted'
    session.classification = classifyImport(null, state.bundles, {
      forcedOutcome: 'interrupted',
      interruptedReason: 'Échec ouverture portail.',
    })
    notify(session)
    return { done: true }
  }
  return {}
}

async function nodeAgentLoop(state: typeof ImportState.State) {
  const session = getSession(state.sessionId)
  if (!session || session.mode === 'fixture' || !session.browser) return {}

  const page = session.browser.page
  for (let i = 0; i < 12; i++) {
    try {
      await assertAllowlisted(page, session.source)
      const snapshot = await a11ySnapshot(page)
      const plan = await planNextAction({
        source: session.source,
        url: page.url(),
        snapshot,
        steps: session.steps.map((s) => s.message),
      })
      pushStep(session, 'info', `Agent: ${plan.tool} — ${plan.reason}`)

      if (plan.tool === 'wait_human') {
        session.status = 'human_gate'
        session.humanGate = {
          reason: plan.reason,
          reasonCode: plan.reasonCode ?? 'other',
        }
        notify(session)
        const action = await waitForResume(session)
        session.humanGate = null
        if (action === 'cancel') {
          session.status = 'cancelled'
          session.classification = classifyImport(null, state.bundles, {
            forcedOutcome: 'interrupted',
            interruptedReason: 'Simulation annulée. Aucune donnée acceptée.',
          })
          notify(session)
          return { done: true }
        }
        session.status = 'running'
        pushStep(session, 'human', 'Reprise après intervention humaine')
        notify(session)
        continue
      }

      if (plan.tool === 'abort') {
        session.status = 'interrupted'
        session.classification = classifyImport(null, state.bundles, {
          forcedOutcome: 'interrupted',
          interruptedReason: plan.reason || 'Structure de page inconnue.',
        })
        notify(session)
        return { done: true }
      }

      if (plan.tool === 'extract_fields' || plan.tool === 'done') {
        const extracted =
          plan.extract ??
          (await heuristicExtract(page)) ??
          null
        session.extracted = extracted
        pushStep(session, 'ok', 'Lecture simulée / extraction terminée')
        notify(session)
        return {}
      }

      if (plan.tool === 'click' && plan.selector) {
        await safeClick(page, plan.selector)
      } else if (plan.tool === 'type' && plan.selector && plan.text !== undefined) {
        await safeType(page, plan.selector, plan.text)
      } else {
        session.errorBudget -= 1
        if (session.errorBudget <= 0) {
          session.status = 'interrupted'
          session.classification = classifyImport(null, state.bundles, {
            forcedOutcome: 'interrupted',
            interruptedReason: 'Budget d’erreurs agent épuisé.',
          })
          notify(session)
          return { done: true }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'agent_error'
      pushStep(session, 'warn', msg)
      session.errorBudget -= 1
      if (msg === 'password_requires_human') {
        session.status = 'human_gate'
        session.humanGate = {
          reason: 'Saisie mot de passe requise (humain).',
          reasonCode: 'password',
        }
        notify(session)
        const action = await waitForResume(session)
        session.humanGate = null
        if (action === 'cancel') {
          session.status = 'cancelled'
          session.classification = classifyImport(null, state.bundles, {
            forcedOutcome: 'interrupted',
            interruptedReason: 'Annulé à la porte humaine.',
          })
          notify(session)
          return { done: true }
        }
        session.status = 'running'
        continue
      }
      if (session.errorBudget <= 0 || msg.startsWith('url_not_allowlisted')) {
        session.status = 'interrupted'
        session.classification = classifyImport(null, state.bundles, {
          forcedOutcome: 'interrupted',
          interruptedReason: msg,
        })
        notify(session)
        return { done: true }
      }
    }
  }

  // Fallback heuristic after loop
  if (!session.extracted && session.browser) {
    session.extracted = await heuristicExtract(session.browser.page)
  }
  if (!session.extracted) {
    session.status = 'interrupted'
    session.classification = classifyImport(null, state.bundles, {
      forcedOutcome: 'interrupted',
      interruptedReason: 'Extraction incomplète après boucle agent.',
    })
    notify(session)
    return { done: true }
  }
  return {}
}

async function nodeExtract(state: typeof ImportState.State) {
  const session = getSession(state.sessionId)
  if (!session) return { done: true }
  if (session.status === 'interrupted' || session.status === 'cancelled') {
    return { done: true }
  }

  if (session.mode === 'fixture') {
    // Small delay to mimic old 700ms pipeline for UX.
    await new Promise((r) => setTimeout(r, 400))
    session.extracted = fixtureExtract(session.source, session.fixtureOutcome)
    if (session.fixtureOutcome === 'interrupted') {
      pushStep(
        session,
        'error',
        'Structure de page inconnue. Aucun champ accepté; reprise manuelle requise.',
      )
    } else {
      pushStep(
        session,
        'ok',
        `Lecture simulée terminée · ${session.source} · fixture locale, aucune connexion`,
      )
    }
    notify(session)
    return {}
  }

  if (!session.extracted && session.browser) {
    session.extracted = await heuristicExtract(session.browser.page)
  }
  return {}
}

async function nodeClassify(state: typeof ImportState.State) {
  const session = getSession(state.sessionId)
  if (!session) return { done: true }
  if (session.status === 'interrupted' || session.status === 'cancelled') {
    return { done: true }
  }

  const forced: ImportOutcome | undefined =
    session.mode === 'fixture' ? session.fixtureOutcome : undefined
  const classification = classifyImport(session.extracted, state.bundles, {
    forcedOutcome: forced,
    interruptedReason:
      forced === 'interrupted'
        ? 'Structure de page inconnue. Aucun champ accepté; reprise manuelle requise.'
        : undefined,
  })
  session.classification = classification
  session.mappingRows = classification.rows
  if (classification.outcome === 'interrupted') {
    session.status = 'interrupted'
  } else {
    session.status = 'await_confirm'
    pushStep(session, 'ok', `Classification · ${classification.outcome}`)
  }
  notify(session)
  return { done: true }
}

async function nodeCleanup(state: typeof ImportState.State) {
  const session = getSession(state.sessionId)
  if (session?.browser) {
    await closeBrowser(session.browser)
    session.browser = null
  }
  return {}
}

function routeAfterOpen(state: typeof ImportState.State): string {
  if (state.done) return 'cleanup'
  const session = getSession(state.sessionId)
  if (!session) return 'cleanup'
  if (session.mode === 'fixture') return 'extract'
  return 'agent_loop'
}

function routeAfterAgent(state: typeof ImportState.State): string {
  if (state.done) return 'cleanup'
  return 'extract'
}

function routeAfterExtract(state: typeof ImportState.State): string {
  if (state.done) return 'cleanup'
  return 'classify'
}

const graph = new StateGraph(ImportState)
  .addNode('open', nodeOpen)
  .addNode('agent_loop', nodeAgentLoop)
  .addNode('extract', nodeExtract)
  .addNode('classify', nodeClassify)
  .addNode('cleanup', nodeCleanup)
  .addEdge(START, 'open')
  .addConditionalEdges('open', routeAfterOpen, {
    agent_loop: 'agent_loop',
    extract: 'extract',
    cleanup: 'cleanup',
  })
  .addConditionalEdges('agent_loop', routeAfterAgent, {
    extract: 'extract',
    cleanup: 'cleanup',
  })
  .addConditionalEdges('extract', routeAfterExtract, {
    classify: 'classify',
    cleanup: 'cleanup',
  })
  .addEdge('classify', 'cleanup')
  .addEdge('cleanup', END)

export const importGraph = graph.compile()

export async function runImportGraph(input: {
  session: ImportSession
  bundles: DeskBundle[]
}): Promise<void> {
  await importGraph.invoke({
    sessionId: input.session.id,
    bundles: input.bundles,
    done: false,
  })
}

export type { ImportSource, ExtractedImport }
