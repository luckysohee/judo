import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import PlaceDetailPage from "./pages/PlaceDetailPage";
import CuratorPageScreen from "./pages/CuratorPageScreen";
import SavedPlacesPage from "./pages/SavedPlacesPage";
import AdminApplicationsPage from "./pages/AdminApplicationsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/place/:id" element={<PlaceDetailPage />} />
      <Route path="/curator/:name" element={<CuratorPageScreen />} />
      <Route path="/saved" element={<SavedPlacesPage />} />
      <Route path="/admin/applications" element={<AdminApplicationsPage />} />
    </Routes>
  );
}

export default App;