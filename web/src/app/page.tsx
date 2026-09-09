import { Dashboard } from "@/components/dashboard";
import { getSubjects } from "@/lib/subjects";

export default async function Home() {
  const subjects = await getSubjects();
  return <Dashboard initialSubjects={subjects} />;
}
