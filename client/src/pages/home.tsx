import Header from "@/components/header";
import HeroSection from "@/components/hero-section";
import AdvantagesSection from "@/components/advantages-section";
import ProgramsSection from "@/components/programs-section";
import FounderSection from "@/components/founder-section";
import CampusSection from "@/components/campus-section";
import ContactSection from "@/components/contact-section";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <AdvantagesSection />
      <ProgramsSection />
      <FounderSection />
      <CampusSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
