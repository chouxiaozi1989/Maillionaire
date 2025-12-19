<template>
  <div class="oauth-callback">
    <div class="callback-content">
      <a-spin size="large" />
      <p class="callback-message">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message as antMessage } from 'ant-design-vue'

const route = useRoute()
const router = useRouter()
const message = ref('正在处理 OAuth2 认证...')

onMounted(async () => {
  try {
    const { code, state, error, error_description } = route.query

    console.log('[OAuth Callback] Received params:', { 
      code: code ? 'present' : 'missing', 
      state: state ? 'present' : 'missing',
      error,
      hasOpener: !!window.opener,
      url: window.location.href 
    })

    // 检查是否有错误
    if (error) {
      message.value = `认证失败: ${error_description || error}`
      antMessage.error(`OAuth2 认证失败: ${error_description || error}`)
      
      // 向父窗口发送错误消息
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'oauth2-callback',
            error: error,
            error_description: error_description,
          }, window.location.origin)
          console.log('[OAuth Callback] Error message sent to opener')
        } catch (e) {
          console.error('[OAuth Callback] Failed to send error to opener:', e)
        }
      }
      
      setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.close()
        } else {
          router.push('/login')
        }
      }, 3000)
      return
    }

    // 检查是否有授权码
    if (!code) {
      message.value = '未收到授权码，认证失败'
      antMessage.error('OAuth2 认证失败：未收到授权码')
      
      // 向父窗口发送错误消息
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'oauth2-callback',
            error: 'no_code',
            error_description: '未收到授权码',
          }, window.location.origin)
          console.log('[OAuth Callback] No code error sent to opener')
        } catch (e) {
          console.error('[OAuth Callback] Failed to send error to opener:', e)
        }
      }
      
      setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.close()
        } else {
          router.push('/login')
        }
      }, 3000)
      return
    }

    // 成功获取授权码
    console.log('[OAuth Callback] Authorization successful, code received')
    message.value = '授权成功，正在完成登录...'

    // 向父窗口发送成功消息
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          type: 'oauth2-callback',
          code: code,
          state: state,
        }, window.location.origin)
        
        console.log('[OAuth Callback] Success message sent to opener')
        antMessage.success('授权成功！')
        
        // 稍微延迟后关闭窗口，确保消息已发送
        setTimeout(() => {
          console.log('[OAuth Callback] Closing popup window')
          window.close()
        }, 500)
      } catch (e) {
        console.error('[OAuth Callback] Failed to send success to opener:', e)
        // 如果发送消息失败，使用 sessionStorage 后备方案
        sessionStorage.setItem('oauth2_code', code)
        sessionStorage.setItem('oauth2_state', state)
        antMessage.success('授权成功！正在跳转...')
        setTimeout(() => {
          router.push('/login')
        }, 1000)
      }
    } else {
      // 如果不是弹窗，使用 sessionStorage 后备方案
      console.log('[OAuth Callback] No opener window, using sessionStorage fallback')
      sessionStorage.setItem('oauth2_code', code)
      sessionStorage.setItem('oauth2_state', state)
      antMessage.success('授权成功！正在跳转...')
      
      setTimeout(() => {
        router.push('/login')
      }, 1000)
    }
  } catch (error) {
    console.error('[OAuth Callback] Processing failed:', error)
    message.value = '处理认证结果时出错'
    antMessage.error('处理认证结果时出错')
    
    // 向父窗口发送错误消息
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          type: 'oauth2-callback',
          error: 'processing_error',
          error_description: error.message,
        }, window.location.origin)
      } catch (e) {
        console.error('[OAuth Callback] Failed to send processing error to opener:', e)
      }
    }
    
    setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        window.close()
      } else {
        router.push('/login')
      }
    }, 3000)
  }
})
</script>

<style lang="scss" scoped>
.oauth-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.callback-content {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  min-width: 400px;
}

.callback-message {
  margin-top: 24px;
  font-size: 16px;
  color: #595959;
}
</style>
