package com.elilearnapps.animaladventures

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsDefaults
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.ExternalSoMapping

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(new MyReactNativePackage());
            return PackageList(this).packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // Initialize SoLoader with React's external mapping so merged libs resolve
    try {
      SoLoader.init(this, object : ExternalSoMapping {
        override fun mapLibName(input: String): String {
          return OpenSourceMergedSoMapping.mapLibName(input)
        }

        override fun invokeJniOnload(libraryName: String) {
          OpenSourceMergedSoMapping.invokeJniOnload(libraryName)
        }
      })
    } catch (_: Throwable) {
      SoLoader.init(this, false)
    }
    // Ensure RN merged JNI mapping is available (react_featureflagsjni, etc.)
    // Disable bridgeless-related feature flags to avoid loading libreact_featureflagsjni in release
    try {
      val flagsProvider = object : ReactNativeFeatureFlagsDefaults() {
        override fun enableBridgelessArchitecture(): Boolean = false
        override fun useTurboModules(): Boolean = false
        override fun enableFabricRenderer(): Boolean = false
        override fun useFabricInterop(): Boolean = false
      }
      ReactNativeFeatureFlags.dangerouslyForceOverride(flagsProvider)
    } catch (_: Throwable) {}
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
