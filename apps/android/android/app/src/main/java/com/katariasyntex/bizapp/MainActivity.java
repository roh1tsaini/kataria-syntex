package com.katariasyntex.bizapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-specific native code ships as a registered plugin class — no
        // separate npm package for one screen's worth of installer logic.
        registerPlugin(InstallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
