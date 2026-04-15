import { I18nProvider } from "./i18n";
import PackItScreen from "./screens/PackItScreen";

export default function App() {
  return (
    <I18nProvider>
      <PackItScreen />
    </I18nProvider>
  );
}
