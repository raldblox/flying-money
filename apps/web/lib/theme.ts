export const THEME_STORAGE_KEY = 'flying-money:theme'
/** Fixed code only: the CSP allows this exact script by its content hash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`
