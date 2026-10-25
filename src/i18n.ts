// The few texts of the CLI itself. Most of what people read comes from the
// server, already in their language.
export type Locale = "nl" | "en" | "de" | "fr";

export const messages = {
  nl: {
    token_rejected: "De server weigert SPAICELY_TOKEN: verkeerd, ingetrokken of verlopen.",
    not_logged_in: "Je bent niet ingelogd. Log in met: spaicely login",
    login_opening: "De browser opent de inlogpagina van Spaicely. Lukt dat niet, open dan:",
    login_open: "Open deze link in een browser om in te loggen:",
    login_waiting: "Wachten op je toestemming in de browser...",
    login_done: "Ingelogd als {name}, voor account {account}.",
    login_failed: "Inloggen is niet gelukt: {reason}",
    logout_done: "Uitgelogd; de koppeling van deze computer is ingetrokken.",
    no_site: "Welke site? Geef --site <nummer of domein>, of zet site in spaicely.toml (spaicely init).",
    site_unknown: "Geen site gevonden voor '{site}'. spaicely sites toont de sites waar je bij mag.",
    init_exists: "spaicely.toml bestaat al.",
    init_written: "spaicely.toml geschreven ({generator}). Controleer site, dir en build, en draai dan: spaicely deploy",
    building: "Bouwen: {command}",
    build_failed: "De build stopte met code {code}.",
    dir_missing: "De map {dir} bestaat niet.",
    no_index: "{dir} heeft geen index.html in de hoofdmap.",
    changes: "{added} nieuw, {changed} gewijzigd, {removed} weg, {same} gelijk.",
    no_changes: "Geen wijzigingen ten opzichte van de live versie.",
    uploading: "Uploaden: {files} bestanden, {size}.",
    uploaded: "Versie {number} staat klaar. Live zetten: spaicely publish {number}",
    publish_confirm: "Versie {number} van {site} live zetten?",
    publishing: "Versie {number} gaat live...",
    published: "Versie {number} is live.",
    publish_slow: "Versie {number} is nog niet live; spaicely versions laat zien wanneer het zover is.",
    aborted: "Niets gedaan.",
    serving: "{dir} op {url} (Ctrl-C stopt)",
    yes_no: "[j/N]",
    yes_answers: "j,ja,y,yes",
    no_tty: "Bevestigen kan hier niet; geef --yes als je het zeker weet.",
  },
  en: {
    token_rejected: "The server refuses SPAICELY_TOKEN: wrong, revoked or expired.",
    not_logged_in: "You are not signed in. Sign in with: spaicely login",
    login_opening: "Your browser opens the Spaicely sign-in page. If it does not, open:",
    login_open: "Open this link in a browser to sign in:",
    login_waiting: "Waiting for your consent in the browser...",
    login_done: "Signed in as {name}, for account {account}.",
    login_failed: "Signing in failed: {reason}",
    logout_done: "Signed out; this computer's connection is revoked.",
    no_site: "Which site? Pass --site <number or domain>, or set site in spaicely.toml (spaicely init).",
    site_unknown: "No site found for '{site}'. spaicely sites lists the sites you can work on.",
    init_exists: "spaicely.toml already exists.",
    init_written: "Wrote spaicely.toml ({generator}). Check site, dir and build, then run: spaicely deploy",
    building: "Building: {command}",
    build_failed: "The build stopped with code {code}.",
    dir_missing: "The folder {dir} does not exist.",
    no_index: "{dir} has no index.html at its root.",
    changes: "{added} new, {changed} changed, {removed} removed, {same} unchanged.",
    no_changes: "No changes compared to the live version.",
    uploading: "Uploading {files} files, {size}.",
    uploaded: "Version {number} is ready. Put it live with: spaicely publish {number}",
    publish_confirm: "Put version {number} of {site} live?",
    publishing: "Version {number} is going live...",
    published: "Version {number} is live.",
    publish_slow: "Version {number} is not live yet; spaicely versions shows when it is.",
    aborted: "Nothing done.",
    serving: "{dir} on {url} (Ctrl-C stops)",
    yes_no: "[y/N]",
    yes_answers: "y,yes",
    no_tty: "Cannot ask for confirmation here; pass --yes if you are sure.",
  },
  de: {
    token_rejected: "Der Server lehnt SPAICELY_TOKEN ab: falsch, widerrufen oder abgelaufen.",
    not_logged_in: "Du bist nicht angemeldet. Anmelden mit: spaicely login",
    login_opening: "Der Browser öffnet die Anmeldeseite von Spaicely. Falls nicht, öffne:",
    login_open: "Öffne diesen Link in einem Browser, um dich anzumelden:",
    login_waiting: "Warte auf deine Zustimmung im Browser...",
    login_done: "Angemeldet als {name}, für Konto {account}.",
    login_failed: "Anmelden fehlgeschlagen: {reason}",
    logout_done: "Abgemeldet; die Verbindung dieses Computers ist widerrufen.",
    no_site: "Welche Website? Gib --site <Nummer oder Domain> an oder setze site in spaicely.toml (spaicely init).",
    site_unknown: "Keine Website für '{site}' gefunden. spaicely sites zeigt die Websites, an denen du arbeiten darfst.",
    init_exists: "spaicely.toml gibt es schon.",
    init_written: "spaicely.toml geschrieben ({generator}). Prüfe site, dir und build und starte dann: spaicely deploy",
    building: "Build: {command}",
    build_failed: "Der Build endete mit Code {code}.",
    dir_missing: "Der Ordner {dir} existiert nicht.",
    no_index: "{dir} hat keine index.html im Hauptordner.",
    changes: "{added} neu, {changed} geändert, {removed} entfernt, {same} gleich.",
    no_changes: "Keine Änderungen gegenüber der Live-Version.",
    uploading: "Hochladen: {files} Dateien, {size}.",
    uploaded: "Version {number} steht bereit. Live schalten: spaicely publish {number}",
    publish_confirm: "Version {number} von {site} live schalten?",
    publishing: "Version {number} geht live...",
    published: "Version {number} ist live.",
    publish_slow: "Version {number} ist noch nicht live; spaicely versions zeigt, wann es so weit ist.",
    aborted: "Nichts getan.",
    serving: "{dir} auf {url} (Strg-C beendet)",
    yes_no: "[j/N]",
    yes_answers: "j,ja,y,yes",
    no_tty: "Bestätigen geht hier nicht; gib --yes an, wenn du sicher bist.",
  },
  fr: {
    token_rejected: "Le serveur refuse SPAICELY_TOKEN : erroné, révoqué ou expiré.",
    not_logged_in: "Vous n'êtes pas connecté. Connectez-vous avec : spaicely login",
    login_opening: "Le navigateur ouvre la page de connexion de Spaicely. Sinon, ouvrez :",
    login_open: "Ouvrez ce lien dans un navigateur pour vous connecter :",
    login_waiting: "En attente de votre accord dans le navigateur...",
    login_done: "Connecté en tant que {name}, pour le compte {account}.",
    login_failed: "La connexion a échoué : {reason}",
    logout_done: "Déconnecté ; la connexion de cet ordinateur est révoquée.",
    no_site: "Quel site ? Passez --site <numéro ou domaine>, ou indiquez site dans spaicely.toml (spaicely init).",
    site_unknown: "Aucun site trouvé pour « {site} ». spaicely sites liste les sites auxquels vous avez accès.",
    init_exists: "spaicely.toml existe déjà.",
    init_written: "spaicely.toml écrit ({generator}). Vérifiez site, dir et build, puis lancez : spaicely deploy",
    building: "Construction : {command}",
    build_failed: "La construction s'est arrêtée avec le code {code}.",
    dir_missing: "Le dossier {dir} n'existe pas.",
    no_index: "{dir} n'a pas de index.html à la racine.",
    changes: "{added} nouveaux, {changed} modifiés, {removed} supprimés, {same} identiques.",
    no_changes: "Aucun changement par rapport à la version en ligne.",
    uploading: "Envoi de {files} fichiers, {size}.",
    uploaded: "La version {number} est prête. Mise en ligne : spaicely publish {number}",
    publish_confirm: "Mettre en ligne la version {number} de {site} ?",
    publishing: "La version {number} passe en ligne...",
    published: "La version {number} est en ligne.",
    publish_slow: "La version {number} n'est pas encore en ligne ; spaicely versions indique quand elle le sera.",
    aborted: "Rien n'a été fait.",
    serving: "{dir} sur {url} (Ctrl-C pour arrêter)",
    yes_no: "[o/N]",
    yes_answers: "o,oui,y,yes",
    no_tty: "Impossible de demander une confirmation ici ; passez --yes si vous êtes sûr.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof typeof messages.nl;

let current: Locale = fromEnvironment();

export function fromEnvironment(env = process.env): Locale {
  const lang = (env.SPAICELY_LANG || env.LC_ALL || env.LC_MESSAGES || env.LANG || "").toLowerCase().slice(0, 2);
  return isLocale(lang) ? lang : "en";
}

export function isLocale(value: unknown): value is Locale {
  return value === "nl" || value === "en" || value === "de" || value === "fr";
}

export function setLocale(locale: unknown): void {
  if (isLocale(locale)) current = locale;
}

export function locale(): Locale {
  return current;
}

export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  return messages[current][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
