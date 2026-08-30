// Pipeline commercial : suivi des leads du site (chatbot, préinscriptions,
// contacts) avec changement d'étape, notes et mise en avant des relances dues.
import { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { STAGES_LEAD, type Lead, type StageLead } from "@shared/schema";
import { ArrowLeft, Phone, Mail, MessageCircle, Loader2 } from "lucide-react";

const LIBELLES: Record<StageLead, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  relance: "Relance",
  visite: "Visite",
  preinscrit: "Préinscrit",
  inscrit: "Inscrit ✅",
  perdu: "Perdu",
};

const COULEURS: Record<StageLead, string> = {
  nouveau: "bg-orange-100 text-orange-800",
  contacte: "bg-blue-100 text-blue-800",
  relance: "bg-yellow-100 text-yellow-800",
  visite: "bg-purple-100 text-purple-800",
  preinscrit: "bg-teal-100 text-teal-800",
  inscrit: "bg-green-100 text-green-800",
  perdu: "bg-gray-200 text-gray-600",
};

function dateFr(v: string | Date | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminLeads() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtre, setFiltre] = useState<StageLead | "tous">("tous");
  const [noteEnCours, setNoteEnCours] = useState<{ id: string; texte: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/admin/login");
  }, [isAuthenticated, isLoading, setLocation]);

  const { data, isLoading: leadsLoading } = useQuery<{ success: boolean; leads: Lead[] }>({
    queryKey: ["/api/admin/leads"],
    enabled: isAuthenticated,
  });

  const majMutation = useMutation({
    mutationFn: async ({ id, donnees }: { id: string; donnees: Record<string, unknown> }) => {
      return await apiRequest(`/api/admin/leads/${id}`, "PUT", donnees);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      toast({ title: "Lead mis à jour" });
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e.message || "Mise à jour impossible", variant: "destructive" });
    },
  });

  const tous = data?.leads ?? [];
  const maintenant = Date.now();
  const leads = (filtre === "tous" ? tous : tous.filter((l) => l.stage === filtre))
    .slice()
    .sort((a, b) => {
      // Les relances dues d'abord, puis les plus récents.
      const dueA = a.nextFollowUpAt && new Date(a.nextFollowUpAt).getTime() <= maintenant ? 0 : 1;
      const dueB = b.nextFollowUpAt && new Date(b.nextFollowUpAt).getTime() <= maintenant ? 0 : 1;
      if (dueA !== dueB) return dueA - dueB;
      return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
    });

  const compteur = (s: StageLead) => tous.filter((l) => l.stage === s).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/dashboard")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> Tableau de bord
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline des leads</h1>
        </div>

        {/* Filtres par étape */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFiltre("tous")}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${filtre === "tous" ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}
            data-testid="filter-tous"
          >
            Tous ({tous.length})
          </button>
          {STAGES_LEAD.map((s) => (
            <button
              key={s}
              onClick={() => setFiltre(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${filtre === s ? "bg-gray-900 text-white" : `bg-white ${COULEURS[s].split(" ")[1]}`}`}
              data-testid={`filter-${s}`}
            >
              {LIBELLES[s]} ({compteur(s)})
            </button>
          ))}
        </div>

        {leadsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-gray-500 text-center py-16">Aucun lead pour ce filtre pour l'instant.</p>
        ) : (
          <div className="space-y-4">
            {leads.map((l) => {
              const due = l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() <= maintenant;
              return (
                <Card key={l.id} className={`border ${due ? "border-orange-400 bg-orange-50/40" : "border-gray-200"}`} data-testid={`lead-${l.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-900">{l.name || "Sans nom"}</span>
                          <Badge className={COULEURS[l.stage as StageLead]}>{LIBELLES[l.stage as StageLead]}</Badge>
                          <Badge variant="outline">{l.source}</Badge>
                          {due && <Badge className="bg-orange-500 text-white">Relance due</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-700">
                          {l.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" /> {l.phone}
                              <a
                                href={`https://wa.me/225${l.phone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-700 underline flex items-center gap-0.5 ml-1"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                              </a>
                            </span>
                          )}
                          {l.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" /> {l.email}
                            </span>
                          )}
                          {l.filiere && <span>Filière : {l.filiere}</span>}
                          {l.campus && <span>Campus : {l.campus}</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Créé le {dateFr(l.createdAt)} · Prochaine action : {dateFr(l.nextFollowUpAt)}
                        </p>
                        {l.notes && (
                          <pre className="text-xs text-gray-600 bg-gray-100 rounded p-2 mt-2 whitespace-pre-wrap font-sans max-h-28 overflow-y-auto">
                            {l.notes}
                          </pre>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <select
                          value={l.stage}
                          onChange={(e) => majMutation.mutate({ id: l.id, donnees: { stage: e.target.value } })}
                          className="border rounded-md px-2 py-1.5 text-sm bg-white"
                          data-testid={`select-stage-${l.id}`}
                        >
                          {STAGES_LEAD.map((s) => (
                            <option key={s} value={s}>
                              {LIBELLES[s]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNoteEnCours({ id: l.id, texte: "" })}
                          data-testid={`button-note-${l.id}`}
                        >
                          + Note
                        </Button>
                      </div>
                    </div>

                    {noteEnCours?.id === l.id && (
                      <div className="mt-3 flex gap-2">
                        <Textarea
                          value={noteEnCours.texte}
                          onChange={(e) => setNoteEnCours({ id: l.id, texte: e.target.value })}
                          placeholder="Compte-rendu d'appel, objection, prochaine étape…"
                          className="text-sm"
                          rows={2}
                        />
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            disabled={!noteEnCours.texte.trim() || majMutation.isPending}
                            onClick={() => {
                              const horodatage = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
                              majMutation.mutate({
                                id: l.id,
                                donnees: { notes: `${l.notes ? l.notes + "\n" : ""}[${horodatage}] ${noteEnCours.texte.trim()}` },
                              });
                              setNoteEnCours(null);
                            }}
                          >
                            Enregistrer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setNoteEnCours(null)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
