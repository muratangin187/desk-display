package com.muratangin.deskdisplay

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var rootLayout: FrameLayout
    private lateinit var webView: WebView
    private var overlayContainer: FrameLayout? = null
    private var overlayWebView: WebView? = null
    private val ioExecutor = Executors.newCachedThreadPool()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        applyImmersiveMode()

        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#090C12"))
            keepScreenOn = true
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#090C12"))
            keepScreenOn = true
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
            }

            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val url = request?.url ?: return null
                    return assetLoader.shouldInterceptRequest(url)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    if (url.startsWith("https://appassets.androidplatform.net/")) {
                        return false
                    }
                    openOverlayBrowser(url)
                    return true
                }
            }

            addJavascriptInterface(DeskBridge(), "DeskBridge")
        }

        rootLayout.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        setContentView(rootLayout)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (overlayContainer != null) {
                    closeOverlayBrowser()
                    return
                }
                webView.evaluateJavascript("window.__deskHandleBack ? window.__deskHandleBack() : false") { result ->
                    if (result != "true") {
                        // In kiosk/desk mode, keep app open unless user uses home/recents
                    }
                }
            }
        })

        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
    }

    override fun onResume() {
        super.onResume()
        applyImmersiveMode()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applyImmersiveMode()
        }
    }

    override fun onDestroy() {
        ioExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun applyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun openOverlayBrowser(url: String) {
        runOnUiThread {
            closeOverlayBrowser()

            val container = FrameLayout(this).apply {
                setBackgroundColor(Color.parseColor("#090C12"))
                keepScreenOn = true
            }

            val browser = WebView(this).apply {
                setBackgroundColor(Color.WHITE)
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    builtInZoomControls = true
                    displayZoomControls = false
                }
                webChromeClient = WebChromeClient()
                webViewClient = WebViewClient()
                loadUrl(url)
            }

            val closeButton = TextView(this).apply {
                text = "✕  Kapat"
                setTextColor(Color.WHITE)
                textSize = 14f
                setPadding(36, 20, 36, 20)
                setBackgroundColor(Color.parseColor("#CC0F172A"))
                setOnClickListener { closeOverlayBrowser() }
            }

            container.addView(
                browser,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            container.addView(
                closeButton,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    Gravity.TOP or Gravity.END
                ).apply {
                    topMargin = 24
                    rightMargin = 24
                }
            )

            rootLayout.addView(
                container,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            overlayContainer = container
            overlayWebView = browser
        }
    }

    private fun closeOverlayBrowser() {
        runOnUiThread {
            overlayWebView?.destroy()
            overlayWebView = null
            overlayContainer?.let { rootLayout.removeView(it) }
            overlayContainer = null
            applyImmersiveMode()
        }
    }

    inner class DeskBridge {
        @JavascriptInterface
        fun fetchUrl(requestId: String, targetUrl: String) {
            ioExecutor.execute {
                val payload = JSONObject()
                var conn: HttpURLConnection? = null
                try {
                    val url = URL(targetUrl)
                    conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 12000
                        readTimeout = 15000
                        instanceFollowRedirects = true
                        setRequestProperty(
                            "User-Agent",
                            "Mozilla/5.0 (Linux; Android 11; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        )
                        setRequestProperty("Accept", "application/json, text/html, */*")
                    }
                    val status = conn.responseCode
                    val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                    val body = if (stream != null) {
                        BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
                    } else {
                        ""
                    }
                    payload.put("ok", status in 200..299)
                    payload.put("status", status)
                    payload.put("body", body)
                } catch (e: Exception) {
                    payload.put("ok", false)
                    payload.put("error", e.message ?: "Request failed")
                } finally {
                    conn?.disconnect()
                }

                val jsCall =
                    "window.__deskBridgeResolve(${JSONObject.quote(requestId)}, ${payload})"
                webView.post {
                    webView.evaluateJavascript(jsCall, null)
                }
            }
        }

        @JavascriptInterface
        fun openWebPage(url: String) {
            openOverlayBrowser(url)
        }
    }
}
