import { Suspense, useEffect } from "react";
import { lazyWithRetry, clearChunkReloadFlag } from "./utils/lazyWithRetry";
import { Routes, Route, Navigate } from "react-router-dom";
import AlphaAccessGate from "./components/AlphaAccess/AlphaAccessGate";
import { ToastProvider } from "./components/Toast/ToastProvider";
import PostLoginAdminRedirect from "./components/PostLoginAdminRedirect";
import AdminRoute from "./components/AdminRoute";
const Home = lazyWithRetry(() => import("./pages/Home/Home"));
import MapView from "./components/Map/MapView";
import PlaceDetailPage from "./pages/PlaceDetailPage";
import CuratorPageScreen from "./pages/CuratorPageScreen";
import CuratorProfilePage from "./pages/CuratorProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import SavedPlacesPage from "./pages/SavedPlacesPage";
import CuratorApplyForm from "./components/CuratorApplyForm/CuratorApplyForm";
import CheckinTest from "./pages/CheckinTest";
import CourseDetailPage from "./pages/Courses/CourseDetailPage";
import CompletedCoursesPage from "./pages/CompletedCoursesPage";
import CourseCompletionOverlay from "./components/Course/CourseCompletionOverlay";
import EntrySplash from "./components/SplashScreen/EntrySplash";
import { warmupHomeMapBoot } from "./utils/warmupHomeMapBoot";

const AdminHubPage = lazyWithRetry(() => import("./pages/AdminHubPage"));
const AdminApplicationsPage = lazyWithRetry(() => import("./pages/AdminApplicationsPage"));
const SearchInsightsPage = lazyWithRetry(() => import("./pages/SearchInsightsPage"));
const CuratorManagementPage = lazyWithRetry(() => import("./pages/CuratorManagementPage"));
const AdminCuratorsAuditPage = lazyWithRetry(() => import("./pages/AdminCuratorsAuditPage"));
const AdminCuratorChipsOrderPage = lazyWithRetry(
  () => import("./pages/AdminCuratorChipsOrderPage")
);
const AdminAlphaSurveyPage = lazyWithRetry(() => import("./pages/AdminAlphaSurveyPage"));
const StudioHome = lazyWithRetry(() => import("./pages/Studio/StudioHome"));
const StudioFollowersPage = lazyWithRetry(() => import("./pages/Studio/StudioFollowersPage"));
const StudioCourseEditor = lazyWithRetry(() => import("./pages/Studio/StudioCourseEditor"));
const StudioListEditor = lazyWithRetry(() => import("./pages/Studio/StudioListEditor"));
const NewPlace = lazyWithRetry(() => import("./pages/Studio/NewPlace"));
const EditPlace = lazyWithRetry(() => import("./pages/Studio/EditPlace"));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e0e0e",
        color: "rgba(255,255,255,0.72)",
        fontSize: 14,
      }}
    >
      불러오는 중…
    </div>
  );
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function App() {
  useEffect(() => {
    clearChunkReloadFlag();
    warmupHomeMapBoot();
    void import("./pages/Home/Home");
  }, []);

  return (
    <ToastProvider>
    <AlphaAccessGate>
    <CourseCompletionOverlay />
    <EntrySplash />
    <PostLoginAdminRedirect />
    <Routes>
      <Route path="/" element={<Lazy><Home /></Lazy>} />
      <Route path="/map" element={<MapView />} />
      <Route path="/place/:id" element={<PlaceDetailPage />} />
      <Route path="/courses/:courseId" element={<CourseDetailPage />} />
      <Route path="/completed-courses" element={<CompletedCoursesPage />} />
      <Route path="/curator/:name" element={<CuratorPageScreen />} />
      <Route path="/curator-profile/:slug" element={<CuratorProfilePage />} />
      <Route path="/u/:userId" element={<UserProfilePage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/saved" element={<SavedPlacesPage />} />
      <Route path="/admin" element={<AdminRoute />}>
        <Route index element={<Lazy><AdminHubPage /></Lazy>} />
        <Route path="applications" element={<Lazy><AdminApplicationsPage /></Lazy>} />
        <Route path="search-insights" element={<Lazy><SearchInsightsPage /></Lazy>} />
        <Route path="curators" element={<Lazy><AdminCuratorsAuditPage /></Lazy>} />
        <Route
          path="curator-chips"
          element={
            <Lazy>
              <AdminCuratorChipsOrderPage />
            </Lazy>
          }
        />
        <Route path="alpha-survey" element={<Lazy><AdminAlphaSurveyPage /></Lazy>} />
        <Route path="curator/:userId" element={<Lazy><CuratorManagementPage /></Lazy>} />
      </Route>
      <Route path="/curator-apply" element={<CuratorApplyForm />} />
      <Route path="/test-checkin" element={<CheckinTest />} />
      <Route path="/studio" element={<Lazy><StudioHome /></Lazy>} />
      <Route
        path="/studio/courses"
        element={
          <Navigate to="/studio" replace state={{ openStudioCourses: true }} />
        }
      />
      <Route path="/studio/courses/new" element={<Lazy><StudioCourseEditor /></Lazy>} />
      <Route
        path="/studio/courses/:courseId/edit"
        element={<Lazy><StudioCourseEditor /></Lazy>}
      />
      <Route
        path="/studio/lists"
        element={
          <Navigate to="/studio" replace state={{ openStudioLists: true }} />
        }
      />
      <Route path="/studio/lists/new" element={<Lazy><StudioListEditor /></Lazy>} />
      <Route
        path="/studio/lists/:listId/edit"
        element={<Lazy><StudioListEditor /></Lazy>}
      />
      <Route path="/studio/followers" element={<Lazy><StudioFollowersPage /></Lazy>} />
      <Route
        path="/studio/my-saves"
        element={
          <Navigate to="/studio" replace state={{ openStudioList: true }} />
        }
      />
      <Route path="/studio/new-place" element={<Lazy><NewPlace /></Lazy>} />
      <Route path="/studio/place/:id/edit" element={<Lazy><EditPlace /></Lazy>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AlphaAccessGate>
    </ToastProvider>
  );
}

export default App;
