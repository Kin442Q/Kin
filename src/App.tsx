import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";
import { useAuthStore } from "./store/authStore";
import { useSessionSync } from "./hooks/useSessionSync";

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
import SchoolsPage from "./pages/SchoolsPage";
import HomeroomPage from "./pages/HomeroomPage";
import StudentHomePage from "./pages/student/StudentHomePage";
import StudentHomeworkPage from "./pages/student/StudentHomeworkPage";
import StudentGradesPage from "./pages/student/StudentGradesPage";
import StudentLibraryPage from "./pages/student/StudentLibraryPage";
import StudentQuizzesPage from "./pages/student/StudentQuizzesPage";
import StudentQuizPlayPage from "./pages/student/StudentQuizPlayPage";
import StudentExamPage from "./pages/student/StudentExamPage";
import StudentGamesPage from "./pages/student/StudentGamesPage";
import LibraryPage from "./pages/LibraryPage";
import QuizzesPage from "./pages/QuizzesPage";
import SchedulePage from "./pages/SchedulePage";
import MeetingsPage from "./pages/MeetingsPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import TimesheetPage from "./pages/TimesheetPage";
import MenuPage from "./pages/MenuPage";
import SettingsPage from "./pages/SettingsPage";
import SubjectsPage from "./pages/SubjectsPage";
import GradesPage from "./pages/GradesPage";
import HomeworkPage from "./pages/HomeworkPage";
import CheckInAuditPage from "./pages/CheckInAuditPage";
import TermsPage from "./pages/TermsPage";
import ChatPage from "./pages/ChatPage";
import ParentHomePage from "./pages/parent/ParentHomePage";
import ParentSchedulePage from "./pages/parent/ParentSchedulePage";
import ParentGradesPage from "./pages/parent/ParentGradesPage";
import ParentPaymentsPage from "./pages/parent/ParentPaymentsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.role === "TEACHER" || user?.role === "teacher";
  const isParent = user?.role === "PARENT";
  const isStudent = user?.role === "STUDENT";

  useSessionSync();

  // Куда направлять домой по умолчанию:
  //   PARENT → личный кабинет родителя
  //   TEACHER → свой кабинет
  //   остальные → admin/dashboard
  const homePath = isStudent
    ? "/student/home"
    : isParent
    ? "/parent/home"
    : isTeacher
      ? "/teacher/dashboard"
      : "/admin/dashboard";

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={user ? <Navigate to={homePath} replace /> : <LandingPage />}
        />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="teacher">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <RequireRole roles={["TEACHER", "SUPER_ADMIN", "admin"]}>
                  <TeacherDashboard />
                </RequireRole>
              }
            />
          </Route>

          <Route path="student">
            <Route index element={<Navigate to="home" replace />} />
            <Route
              path="home"
              element={
                <RequireRole roles={["STUDENT"]} feature="portal">
                  <StudentHomePage />
                </RequireRole>
              }
            />
            <Route
              path="homework"
              element={
                <RequireRole roles={["STUDENT"]} feature="homework">
                  <StudentHomeworkPage />
                </RequireRole>
              }
            />
            <Route
              path="grades"
              element={
                <RequireRole roles={["STUDENT"]} feature="grades">
                  <StudentGradesPage />
                </RequireRole>
              }
            />
            <Route
              path="library"
              element={
                <RequireRole roles={["STUDENT"]} feature="library">
                  <StudentLibraryPage />
                </RequireRole>
              }
            />
            <Route
              path="quizzes"
              element={
                <RequireRole roles={["STUDENT"]} feature="quiz">
                  <StudentQuizzesPage />
                </RequireRole>
              }
            />
            <Route
              path="quizzes/:id"
              element={
                <RequireRole roles={["STUDENT"]} feature="quiz">
                  <StudentQuizPlayPage />
                </RequireRole>
              }
            />
            <Route
              path="exam"
              element={
                <RequireRole roles={["STUDENT"]} feature="exam_prep">
                  <StudentExamPage />
                </RequireRole>
              }
            />
            <Route
              path="games"
              element={
                <RequireRole roles={["STUDENT"]} feature="games">
                  <StudentGamesPage />
                </RequireRole>
              }
            />
          </Route>

          <Route path="parent">
            <Route index element={<Navigate to="home" replace />} />
            <Route
              path="home"
              element={
                <RequireRole roles={["PARENT"]}>
                  <ParentHomePage />
                </RequireRole>
              }
            />
            <Route
              path="schedule"
              element={
                <RequireRole roles={["PARENT"]} feature="schedule">
                  <ParentSchedulePage />
                </RequireRole>
              }
            />
            <Route
              path="grades"
              element={
                <RequireRole roles={["PARENT"]} feature="grades">
                  <ParentGradesPage />
                </RequireRole>
              }
            />
            <Route
              path="payments"
              element={
                <RequireRole roles={["PARENT"]} feature="payments">
                  <ParentPaymentsPage />
                </RequireRole>
              }
            />
            <Route
              path="chat"
              element={
                <RequireRole roles={["PARENT"]} feature="chat">
                  <ChatPage />
                </RequireRole>
              }
            />
          </Route>

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
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="groups">
                  <GroupsPage />
                </RequireRole>
              }
            />
            <Route
              path="groups/:id"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="groups">
                  <GroupDetailPage />
                </RequireRole>
              }
            />
            <Route
              path="children"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="students">
                  <ChildrenPage />
                </RequireRole>
              }
            />
            <Route
              path="attendance"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="attendance">
                  <AttendancePage />
                </RequireRole>
              }
            />
            <Route
              path="payments"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="payments">
                  <PaymentsPage />
                </RequireRole>
              }
            />
            <Route
              path="expenses"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="expenses">
                  <ExpensesPage />
                </RequireRole>
              }
            />
            <Route
              path="analytics"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="analytics">
                  <AnalyticsPage />
                </RequireRole>
              }
            />
            <Route
              path="staff"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="staff">
                  <StaffPage />
                </RequireRole>
              }
            />
            <Route
              path="teachers"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="teachers">
                  <TeachersPage />
                </RequireRole>
              }
            />
            <Route
              path="schools"
              element={
                <RequireRole roles={["SUPER_ADMIN"]}>
                  <SchoolsPage />
                </RequireRole>
              }
            />
            {/* Старый адрес: закладки и ссылки продолжают работать */}
            <Route path="kindergartens" element={<Navigate to="/admin/schools" replace />} />
            <Route
              path="homeroom"
              element={
                <RequireRole roles={["TEACHER", "SUPER_ADMIN", "admin"]} feature="homeroom">
                  <HomeroomPage />
                </RequireRole>
              }
            />
            <Route
              path="library"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="library">
                  <LibraryPage />
                </RequireRole>
              }
            />
            <Route
              path="quizzes"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="quiz">
                  <QuizzesPage />
                </RequireRole>
              }
            />
            <Route
              path="schedule"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="schedule">
                  <SchedulePage />
                </RequireRole>
              }
            />
            <Route
              path="meetings"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="meetings">
                  <MeetingsPage />
                </RequireRole>
              }
            />
            <Route
              path="timesheet"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="timesheet">
                  <TimesheetPage />
                </RequireRole>
              }
            />
            <Route
              path="menu"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="menu">
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
            <Route
              path="subjects"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="subjects">
                  <SubjectsPage />
                </RequireRole>
              }
            />
            <Route
              path="grades"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="grades">
                  <GradesPage />
                </RequireRole>
              }
            />
            <Route
              path="homework"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="homework">
                  <HomeworkPage />
                </RequireRole>
              }
            />
            <Route
              path="checkin-audit"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="timesheet">
                  <CheckInAuditPage />
                </RequireRole>
              }
            />
            <Route
              path="terms"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin"]} feature="terms">
                  <TermsPage />
                </RequireRole>
              }
            />
            <Route
              path="chat"
              element={
                <RequireRole roles={["SUPER_ADMIN", "admin", "TEACHER"]} feature="chat">
                  <ChatPage />
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
