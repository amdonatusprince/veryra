"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function PassCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancel = false;
    QRCode.toDataURL(value, {
      margin: 1,
      width: 168,
      errorCorrectionLevel: "M",
      color: { dark: "#14120e", light: "#f6f1e7" },
    })
      .then((url) => {
        if (!cancel) setSrc(url);
      })
      .catch(() => {
        if (!cancel) setSrc("");
      });
    return () => {
      cancel = true;
    };
  }, [value]);

  if (!src) return null;
  return (
    // The code is a data URL drawn in the browser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      width={168}
      height={168}
      className="rounded-md bg-[#f6f1e7] p-2"
    />
  );
}
