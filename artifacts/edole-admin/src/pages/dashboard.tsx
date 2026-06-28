import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/hr", { replace: true });
  }, [setLocation]);
  return null;
}
