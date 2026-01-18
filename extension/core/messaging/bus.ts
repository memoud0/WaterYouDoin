import type { AnyMsg } from "./types";

export function sendToBackground<TRes extends AnyMsg = AnyMsg>(msg: AnyMsg): Promise<TRes> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(res as TRes);
      });
    } catch (e) {
      reject(e);
    }
  });
}