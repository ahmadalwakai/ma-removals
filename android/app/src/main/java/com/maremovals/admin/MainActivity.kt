package com.maremovals.admin

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

class MainActivity : Activity() {
  private lateinit var webView: WebView
  private lateinit var loadingView: View
  private lateinit var errorView: View

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.parseColor("#F8FAFC")
    window.navigationBarColor = Color.parseColor("#F8FAFC")

    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#F8FAFC"))
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
    }

    webView = WebView(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
      setBackgroundColor(Color.parseColor("#F8FAFC"))
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.databaseEnabled = true
      settings.cacheMode = WebSettings.LOAD_DEFAULT
      settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
      webChromeClient = WebChromeClient()
      webViewClient = AdminWebViewClient()
    }

    loadingView = buildLoadingView()
    errorView = buildErrorView().apply { visibility = View.GONE }

    root.addView(webView)
    root.addView(loadingView)
    root.addView(errorView)
    setContentView(root)

    webView.loadUrl(ADMIN_URL)
  }

  override fun onBackPressed() {
    if (::webView.isInitialized && webView.canGoBack()) {
      webView.goBack()
      return
    }
    @Suppress("DEPRECATION")
    super.onBackPressed()
  }

  override fun onDestroy() {
    if (::webView.isInitialized) {
      webView.stopLoading()
      webView.destroy()
    }
    super.onDestroy()
  }

  private fun showLoading(show: Boolean) {
    loadingView.visibility = if (show) View.VISIBLE else View.GONE
  }

  private fun showError(show: Boolean) {
    errorView.visibility = if (show) View.VISIBLE else View.GONE
    webView.visibility = if (show) View.GONE else View.VISIBLE
  }

  private fun buildLoadingView(): View {
    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#F8FAFC"))
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
      addView(ProgressBar(context).apply { isIndeterminate = true })
      addView(TextView(context).apply {
        text = "Opening M&A Admin"
        textSize = 16f
        setTextColor(Color.parseColor("#334155"))
        gravity = Gravity.CENTER
        setPadding(0, dp(14), 0, 0)
      })
    }
  }

  private fun buildErrorView(): View {
    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(24), dp(24), dp(24))
      setBackgroundColor(Color.parseColor("#F8FAFC"))
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
      addView(TextView(context).apply {
        text = "M&A Admin could not open"
        textSize = 22f
        setTextColor(Color.parseColor("#0F172A"))
        gravity = Gravity.CENTER
      })
      addView(TextView(context).apply {
        text = "Check the phone connection, then try again."
        textSize = 15f
        setTextColor(Color.parseColor("#475569"))
        gravity = Gravity.CENTER
        setPadding(0, dp(10), 0, 0)
      })
      addView(Button(context).apply {
        text = "Retry"
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.parseColor("#2563EB"))
        setPadding(dp(20), dp(10), dp(20), dp(10))
        setOnClickListener {
          showError(false)
          showLoading(true)
          webView.loadUrl(ADMIN_URL)
        }
      })
    }
  }

  private fun openExternally(url: String) {
    try {
      startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (_: ActivityNotFoundException) {
      // Ignore unsupported schemes instead of crashing the app.
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }

  private inner class AdminWebViewClient : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
      val uri = request.url
      if (uri.scheme == "http" || uri.scheme == "https") {
        val host = uri.host ?: return false
        if (host == "maremovals.com" || host == "www.maremovals.com") return false
      }
      openExternally(uri.toString())
      return true
    }

    override fun onPageFinished(view: WebView, url: String) {
      showLoading(false)
    }

    override fun onReceivedError(
      view: WebView,
      request: WebResourceRequest,
      error: WebResourceError,
    ) {
      if (request.isForMainFrame) {
        showLoading(false)
        showError(true)
      }
    }
  }

  companion object {
    private const val ADMIN_URL = "https://www.maremovals.com/admin"
  }
}
