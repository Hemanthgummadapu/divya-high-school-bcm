import type { Metadata } from "next";
import OnlineAdmissionForm from "../online-form/page";

export const metadata: Metadata = {
  title: "Apply Online – Divya High School BCM",
  description: "Apply for admission to Divya High School BCM. Fill the online application form.",
};

export default function ApplyOnlinePage() {
  return <OnlineAdmissionForm />;
}
