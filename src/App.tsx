import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";

import Dashboard from "./pages/Dashboard";
import ChildrenPage from "./pages/ChildrenPage";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import AttendancePage from "./pages/AttendancePage";
import PaymentsPage from "./pages/PaymentsPage";
import ExpensesPage from "./pages/ExpensesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import StaffPage from "./pages/StaffPage";
import TeachersPage from "./pages/TeachersPage";
import KindergartensPage from "./pages/KindergartensPage";
import SchedulePage from "./pages/SchedulePage";
import MeetingsPage from "./pages/MeetingsPage";
import MenuPage from "./pages/MenuPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />

          <Route path="admin">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <Dashboard />
                </RequireRole>
              }
            />
            <Route
              path="groups"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <GroupsPage />
                </RequireRole>
              }
            />
            <Route
              path="groups/:id"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <GroupDetailPage />
                </RequireRole>
              }
            />
            <Route
              path="children"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <ChildrenPage />
                </RequireRole>
              }
            />
            <Route
              path="attendance"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <AttendancePage />
                </RequireRole>
              }
            />
            <Route
              path="payments"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <PaymentsPage />
                </RequireRole>
              }
            />
            <Route
              path="expenses"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <ExpensesPage />
                </RequireRole>
              }
            />
            <Route
              path="analytics"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <AnalyticsPage />
                </RequireRole>
              }
            />
            <Route
              path="staff"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <StaffPage />
                </RequireRole>
              }
            />
            <Route
              path="teachers"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <TeachersPage />
                </RequireRole>
              }
            />
            <Route
              path="kindergartens"
              element={
                <RequireRole roles={["SUPER_ADMIN"]}>
                  <KindergartensPage />
                </RequireRole>
              }
            />
            <Route
              path="schedule"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <SchedulePage />
                </RequireRole>
              }
            />
            <Route
              path="meetings"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <MeetingsPage />
                </RequireRole>
              }
            />
            <Route
              path="menu"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]}>
                  <MenuPage />
                </RequireRole>
              }
            />
            <Route
              path="settings"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]}>
                  <SettingsPage />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}
