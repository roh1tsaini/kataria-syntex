package com.katariasyntex.bizapp

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // App-specific native code ships as registered plugin classes — no
        // separate npm package for one screen's installer logic.
        registerPlugin(InstallerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}