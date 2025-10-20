<template>
  <div class="oauth-callback">
    <div class="callback-container">
      <a-spin size="large" />
      <p class="callback-text">正在处理授权...</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // 获取 URL 参数
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const state = urlParams.get('state')
  const error = urlParams.get('error')

  if (error) {
    console.error('OAuth2 error:', error)
    window.close()
  } else if (code) {
    // 将授权码传递给父窗口
    if (window.opener) {
      window.opener.postMessage({ code, state }, window.location.origin)
    }
    // 关闭当前窗口
    setTimeout(() => {
      window.close()
    }, 1000)
  }
})
</script>

<style lang="scss" scoped>
.oauth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.callback-container {
  text-align: center;
  background: white;
  padding: 48px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.callback-text {
  margin-top: 24px;
  font-size: 16px;
  color: #8C8C8C;
}
</style>
