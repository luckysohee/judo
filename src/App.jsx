import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import PlaceDetailPage from "./pages/PlaceDetailPage";
import CuratorPageScreen from "./pages/CuratorPageScreen";
import CuratorProfilePage from "./pages/CuratorProfilePage";
import SavedPlacesPage from "./pages/SavedPlacesPage";
import AdminApplicationsPage from "./pages/AdminApplicationsPage";
import CuratorApplyForm from "./components/CuratorApplyForm/CuratorApplyForm";
// 스튜디오 관련 import
import StudioHome from "./pages/Studio/StudioHome";
import NewPlace from "./pages/Studio/NewPlace";
import EditPlace from "./pages/Studio/EditPlace";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/place/:id" element={<PlaceDetailPage />} />
      <Route path="/curator/:name" element={<CuratorPageScreen />} />
      <Route path="/curator-profile/:slug" element={<CuratorProfilePage />} />
      <Route path="/saved" element={<SavedPlacesPage />} />
      <Route path="/admin/applications" element={<AdminApplicationsPage />} />
      <Route path="/curator-apply" element={<CuratorApplyForm />} />
      {/* 스튜디오 라우트 */}
      <Route path="/studio" element={<StudioHome />} />
      <Route path="/studio/new-place" element={<NewPlace />} />
      <Route path="/studio/place/:id/edit" element={<EditPlace />} />
    </Routes>
  );
}

export default App;