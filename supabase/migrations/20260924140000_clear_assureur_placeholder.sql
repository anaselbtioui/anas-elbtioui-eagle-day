-- Clear signup provision placeholder so insurer select stays empty until a real pick.

update insurers
set display_name = ''
where display_name = 'Assureur';
