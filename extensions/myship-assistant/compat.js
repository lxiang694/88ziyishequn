(() => {
  // Callbacks work on older Chromium builds too. Read lastError inside the callback.
  const call = (owner, method, ...args) => new Promise((resolve, reject) => {
    try {
      owner[method](...args, result => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message || '瀏覽器助手連線失敗'))
        else resolve(result)
      })
    } catch (error) { reject(error) }
  })
  globalThis.HealthMyshipCompat = { call }
})()
