import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type Props = {
  allowed: string[];
  children: React.ReactNode;
};

export default function RoleGuard({ allowed, children }: Props) {
  const { profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!profile || !allowed.includes(profile.system_role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}