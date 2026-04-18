import { I18nProvider } from "./i18n";
import RotatePrompt from "./components/RotatePrompt";
import PackItScreen from "./screens/PackItScreen";

export default function App() {
  return (
    <I18nProvider>
      <RotatePrompt />
      <PackItScreen />
    </I18nProvider>
  );
}
