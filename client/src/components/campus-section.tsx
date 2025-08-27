const campusImages = [
  {
    image: "https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=600",
    title: "Campus Principal",
    location: "Abidjan, Côte d'Ivoire"
  },
  {
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=600",
    title: "Salles de Cours",
    location: "Équipements modernes"
  },
  {
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=600",
    title: "Bibliothèque",
    location: "Espace d'étude"
  },
  {
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=600",
    title: "Lab Informatique",
    location: "Technologies avancées"
  }
];

export default function CampusSection() {
  return (
    <section id="espaces" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-foreground" data-testid="text-campus-title">
            Nos Campus
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-campus-subtitle">
            Des espaces modernes et équipés pour une formation d'excellence
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {campusImages.map((campus, index) => (
            <div 
              key={index} 
              className="relative group overflow-hidden rounded-2xl shadow-lg"
              data-testid={`card-campus-${index}`}
            >
              <img 
                src={campus.image}
                alt={campus.title}
                className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-300"
                data-testid={`img-campus-${index}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="text-lg font-bold" data-testid={`text-campus-title-${index}`}>
                  {campus.title}
                </h3>
                <p className="text-sm opacity-90" data-testid={`text-campus-location-${index}`}>
                  {campus.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
