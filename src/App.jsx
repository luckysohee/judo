import { Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast/ToastProvider";
import PostLoginAdminRedirect from "./components/PostLoginAdminRedirect";
import AdminRoute from "./components/AdminRoute";
import Home from "./pages/Home/Home";
import MapView from "./components/Map/MapView";
import PlaceDetailPage from "./pages/PlaceDetailPage";
import CuratorPageScreen from "./pages/CuratorPageScreen";
import CuratorProfilePage from "./pages/CuratorProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import SavedPlacesPage from "./pages/SavedPlacesPage";
import AdminHubPage from "./pages/AdminHubPage";
import AdminApplicationsPage from "./pages/AdminApplicationsPage";
import SearchInsightsPage from "./pages/SearchInsightsPage";
import CollectionInsightsPage from "./pages/CollectionInsightsPage";
import CuratorManagementPage from "./pages/CuratorManagementPage";
import AdminCuratorsAuditPage from "./pages/AdminCuratorsAuditPage";
import CuratorApplyForm from "./components/CuratorApplyForm/CuratorApplyForm";
import CheckinTest from "./pages/CheckinTest";
import StudioHome from "./pages/Studio/StudioHome";
import StudioFollowersPage from "./pages/Studio/StudioFollowersPage";
import NewPlace from "./pages/Studio/NewPlace";
import EditPlace from "./pages/Studio/EditPlace";
import EntrySplash from "./components/SplashScreen/EntrySplash";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import CollectionsByTagPage from "./pages/CollectionsByTagPage";
import CollectionsSearchPage from "./pages/CollectionsSearchPage";
import MyCollectionsPage from "./pages/MyCollectionsPage";
import MyCollectionManagePage from "./pages/MyCollectionManagePage";

function App() {
  return (
    <ToastProvider>
    <EntrySplash />
    <PostLoginAdminRedirect />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/map" element={<MapView />} />
      <Route path="/place/:id" element={<PlaceDetailPage />} />
      <Route path="/collection/:collectionId" element={<CollectionDetailPage />} />
      <Route path="/collections/tag/:tag" element={<CollectionsByTagPage />} />
      <Route path="/collections/search" element={<CollectionsSearchPage />} />
      <Route path="/my-collections" element={<MyCollectionsPage />} />
      <Route path="/my-collections/:collectionId" element={<MyCollectionManagePage />} />
      <Route path="/curator/:name" element={<CuratorPageScreen />} />
      <Route path="/curator-profile/:slug" element={<CuratorProfilePage />} />
      <Route path="/u/:userId" element={<UserProfilePage />} />
      <Route path="/saved" element={<SavedPlacesPage />} />
      <Route path="/admin" element={<AdminRoute />}>
        <Route index element={<AdminHubPage />} />
        <Route path="applications" element={<AdminApplicationsPage />} />
        <Route path="search-insights" element={<SearchInsightsPage />} />
        <Route
          path="collection-insights"
          element={<CollectionInsightsPage />}
        />
        <Route path="curators" element={<AdminCuratorsAuditPage />} />
        <Route path="curator/:userId" element={<CuratorManagementPage />} />
      </Route>
      <Route path="/curator-apply" element={<CuratorApplyForm />} />
      <Route path="/test-checkin" element={<CheckinTest />} />
      {/* 스튜디오 라우트 */}
      <Route path="/studio" element={<StudioHome />} />
      <Route path="/studio/followers" element={<StudioFollowersPage />} />
      <Route
        path="/studio/my-saves"
        element={
          <Navigate to="/studio" replace state={{ openStudioList: true }} />
        }
      />
      <Route path="/studio/new-place" element={<NewPlace />} />
      <Route path="/studio/place/:id/edit" element={<EditPlace />} />
    </Routes>
    </ToastProvider>
  );
}

export default App;