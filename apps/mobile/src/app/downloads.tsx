/**
 * `/downloads` is the browser's download page. The phone app IS the installed
 * app, so the route has nothing to offer and sends the user to sign-in — the
 * same redirect the web app applies on native shells.
 */
import { Redirect } from "expo-router";

export default function DownloadsRoute() {
  return <Redirect href="/auth" />;
}
