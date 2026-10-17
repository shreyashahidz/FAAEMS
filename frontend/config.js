// The one setting that changes between local dev and the college server , 
// edit this single line for deployment, no rebuild needed (nginx just
// serves the file). For prod, if nginx reverse-proxies /api/ to the
// backend container on the same domain, set this to "/api" instead.
window.FAEMS_API_BASE = "http://localhost:8010/api";
