package com.katariasyntex.bizapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-specific native code ships as registered plugin classes — no
        // separate npm package for one screen's worth of installer and print
        // logic.
        registerPlugin(InstallerPlugin.class);
        registerPlugin(PrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
