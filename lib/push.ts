import webpush from "web-push";

export const VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ??
  "BGbFDTetWUjOx990WK2GcfPPQPveTizSLHn6jxIp_vul9f1hEeHmxTLbo4x_UzIhSRyj7Wao-KAssU2Q1fWSjKQ";

const VAPID_PRIVATE =
  process.env.VAPID_PRIVATE_KEY ?? "xCGi6K581eSPUIkkv89XW_IspH81_dwmP3ZMQ_9IFcw";

webpush.setVapidDetails("mailto:leyrat.quentin@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

export { webpush };
