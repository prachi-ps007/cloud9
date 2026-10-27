import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/Modal.jsx';
import Login from './pages/Login.jsx';
import Pair from './pages/Pair.jsx';
import SharePage from './pages/SharePage.jsx';
import Files from './pages/Files.jsx';
import Storage from './pages/Storage.jsx';
import Devices from './pages/Devices.jsx';
import Shares from './pages/Shares.jsx';
import Trash from './pages/Trash.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/pair" element={<Pair />} />
      <Route path="/s/:token" element={<SharePage />} />

      {/* logged-in */}
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Files />} />
        <Route path="/folder/:folderId" element={<Files />} />
        <Route path="/shared" element={<Shares />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/storage" element={<Storage />} />
        <Route path="/trash" element={<Trash />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
