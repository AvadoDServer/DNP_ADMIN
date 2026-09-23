import React from "react";
import WifiOff from "Icons/WifiOff";

const NoConnection = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 py-20 text-center text-fg">
    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/12 text-danger-text">
      <WifiOff scale={2} />
    </span>
    <h1 className="text-3xl font-bold tracking-tight text-fg">
      Could not connect to AVADO
    </h1>
    <p className="max-w-lg text-sm leading-relaxed text-fg-muted">
      Please make sure your WiFi or VPN connection is still active. Otherwise,
      stop the connection and reconnect and try accessing this page again. If
      the problems persist, please reach us via{" "}
      <a
        href="https://t.me/joinchat/F_LlkBLEoDrFioPNviEpsQ"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent transition-colors hover:text-accent-hover"
      >
        Telegram
      </a>
      .
    </p>
  </div>
);

export default NoConnection;
