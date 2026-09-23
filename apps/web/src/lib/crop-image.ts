import type { Area } from 'react-easy-crop'

/** ID-1 card (permis, carte grise, attestation). */
export const DOCUMENT_CROP_ASPECT = 85.6 / 53.98

/** Guided accident photos. */
export const SCENE_CROP_ASPECT = 4 / 3

const MAX_EDGE = 1600

export function outputSize(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const edge = Math.max(width, height)
  if (edge <= maxEdge || edge <= 0) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
  }
  const scale = maxEdge / edge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image_load_failed'))
    image.src = src
  })
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/** Export the crop box as a JPEG data URL. `pixelCrop` is in the rotated image. */
export async function cropImageToDataUrl(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
): Promise<string> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no_canvas')

  const rotRad = (rotation * Math.PI) / 180
  const box = rotateSize(image.width, image.height, rotation)
  canvas.width = Math.max(1, Math.floor(box.width))
  canvas.height = Math.max(1, Math.floor(box.height))
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rotRad)
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  const x = Math.max(0, Math.floor(pixelCrop.x))
  const y = Math.max(0, Math.floor(pixelCrop.y))
  const width = Math.max(1, Math.floor(pixelCrop.width))
  const height = Math.max(1, Math.floor(pixelCrop.height))
  const data = ctx.getImageData(x, y, width, height)

  const fitted = outputSize(width, height)
  canvas.width = fitted.width
  canvas.height = fitted.height
  const out = canvas.getContext('2d')
  if (!out) throw new Error('no_canvas')
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = width
  cropCanvas.height = height
  cropCanvas.getContext('2d')?.putImageData(data, 0, 0)
  out.drawImage(cropCanvas, 0, 0, fitted.width, fitted.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}
