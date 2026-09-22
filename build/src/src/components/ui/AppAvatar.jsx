import React, { useState } from "react";
import { cn } from "./cn";
import { getClient } from "health/clients";

// The generic AVADO logo that many package manifests ship as their avatar.
export const PLACEHOLDER_AVATARS = ["/ipfs/QmYRmFCtdXvqq3drc6kBXxeWiiMatTfKVpVrmLX883cQbR"];

const ROLE_TINT = {
  execution: "bg-accent/15 text-accent",
  consensus: "bg-brand/15 text-brand",
  monitoring: "bg-warning/15 text-warning",
  mev: "bg-success/15 text-success",
  remote: "bg-fg/10 text-fg",
};

const monogram = pkg => {
  const title = (pkg && pkg.manifest && pkg.manifest.title) || ((pkg && pkg.name) || "?").split(".")[0];
  const words = title.replace(/[-_]/g, " ").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : title.slice(0, 2);
  return letters.toUpperCase();
};

export default function AppAvatar({ pkg, size = 40, className }) {
  const [failed, setFailed] = useState(false);
  const avatar = pkg && pkg.manifest && pkg.manifest.avatar;
  const usable = avatar && !PLACEHOLDER_AVATARS.includes(avatar) && !failed;
  const style = { width: size, height: size };
  if (usable)
    return (
      <img
        src={`http://ipfs.my.ava.do:8080/ipfs/${avatar.replace("/ipfs/", "")}`}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={cn("flex-shrink-0 rounded-[10px] border border-border bg-white object-cover", className)}
      />
    );
  const client = getClient(pkg && pkg.name);
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-[10px] font-display text-sm font-bold",
        ROLE_TINT[client && client.role] || "bg-fg/10 text-fg-muted",
        className
      )}
    >
      {monogram(pkg)}
    </span>
  );
}
