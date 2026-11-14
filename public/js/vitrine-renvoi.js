// Anciens liens et appli installée (« /#/valorant/planning », « /#/ ») : l'espace privé est maintenant sous /app/.
// Chargé en tête de la vitrine, avant tout affichage. Les ancres de la vitrine (#equipes…) n'ont pas de « / ».
if (location.hash.startsWith('#/')) location.replace(`/app/${location.hash}`);
