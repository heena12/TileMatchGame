import type { Translation } from '../strings';

/** Français. Missing keys fall back to English. */
export const fr: Translation = {
  'splash.loading': 'Entrée dans le niveau...',
  'home.play': 'Jouer',
  'home.continue': 'Niveau {level}',
  'home.resume': 'Reprendre - Niveau {level}',
  'home.settings': 'Réglages',
  'home.coins': 'Pièces : {coins}',

  'map.title': 'Niveaux',
  'map.level': 'Niveau {level}',
  'map.levelStars': 'Niveau {level}, {stars} étoiles sur 3',
  'map.locked': 'Niveau {level}, verrouillé',
  'map.range': 'Niveau {first}-{last}',
  'map.back': 'Retour',
  'map.prev': 'Niveaux précédents',
  'map.next': 'Niveaux suivants',

  'revive.oddsBefore': 'Seuls ',
  'revive.oddsAfter': ' des joueurs passent ce niveau',
  'revive.button': 'Réanimer',
  'revive.buttonCost': 'Réanimer pour {cost} pièces',
  'revive.restart': 'Touchez pour recommencer',
  'revive.noCoins': 'Pas assez de pièces pour réanimer.',
  'revive.cannot': 'Rien à annuler.',

  'settings.close': 'Fermer',
  'settings.back': 'Retour',
  'settings.music': 'Musique',
  'settings.vibration': 'Vibration',
  'settings.on': 'activé',
  'settings.off': 'désactivé',
  'settings.toggled': '{name} : {state}',
  'settings.voice': 'Voix',
  'settings.notifications': 'Notifications',

  'daily.title': 'Récompense du jour',
  'daily.day': 'Jour {day}',
  'daily.streak': 'Série de {days} jours',
  'daily.claim': 'Récupérer',
  'daily.coins': '{coins} pièces',
  'daily.received': 'Vous avez reçu : {reward}',
  'daily.comeBack': 'Revenez demain pour la prochaine récompense.',
  'daily.button': 'Récompense du jour, à récupérer',

  'settings.testReminder': 'Envoyer un rappel de test',
  'settings.testReminderSent':
    "Rappel de test dans 10 secondes. Vous pouvez quitter l'app.",
  'settings.testReminderNo': "Autorisez d'abord les notifications.",
  'notify.test.title': 'Rappel de test',
  'notify.test.body': 'Si vous lisez ceci, les notifications fonctionnent.',

  'settings.devSteps': 'Encore {n} appuis pour les outils de développement',
  'settings.devOn': 'Outils de développement activés',

  'notify.channel': 'Rappels',
  'notify.reward.title': 'Votre récompense du jour est prête !',
  'notify.reward.body': 'Récupérez les pièces et boosters du jour.',
  'notify.streak.title': 'Votre série de {days} jours est menacée !',
  'notify.streak.body': "Revenez aujourd'hui pour la garder.",
  'notify.day3.title': 'Les puzzles vous manquent ?',
  'notify.day3.body': 'Un nouveau niveau vous attend.',
  'notify.day7.title': 'Cela fait un moment',
  'notify.day7.body': 'Reprenez Tile Pop là où vous vous êtes arrêté.',
  'settings.colorFriendly': 'Mode daltonien',
  'settings.colorWhenOff':
    'Une fois désactivé, ces types de niveaux reviendront :',
  'settings.colorVariation': 'Niveaux à variations de couleur',
  'common.no': 'Non',
  'common.yes': 'Oui',
  'settings.language': 'Langue',
  'settings.support': 'Assistance',
  'settings.save': 'Sauvegarder ma progression',
  'settings.about': 'À propos',
  'settings.version': 'Version {version}',
  'settings.languageSoon': "D'autres langues arrivent bientôt.",
  'settings.privacy': 'Politique de confidentialité',
  'settings.privacyText':
    "Tile Pop ne vous demande pas de créer un compte et ne collecte ni votre nom, ni votre e-mail, ni votre position. Votre progression, vos pièces et vos réglages sont stockés uniquement sur cet appareil. Les rappels quotidiens sont programmés sur votre appareil et vous pouvez les désactiver dans les Réglages. Si la sauvegarde cloud est activée, seule votre progression de jeu est sauvegardée. Nous ne vendons jamais vos données. Une question ? Contactez-nous depuis Assistance.",
  'settings.supportText':
    "Besoin d'aide ou un problème ? Envoyez-nous un e-mail avec la version de l'application et ce qui s'est passé. Nous vous répondrons dès que possible.",
  'settings.supportEmail': 'Nous écrire',
  'settings.supportFail': 'Aucune application e-mail. Écrivez à {email}',
  'settings.cloudOff': "La sauvegarde cloud n'est pas encore connectée.",
  'settings.aboutText':
    'Associez trois tuiles à la fois et videz le plateau avant que la réserve ne se remplisse. Explorez le monde image par image.',
  'settings.title': 'Réglages',
  'settings.sound': 'Son',
  'settings.haptics': 'Vibrations',
  'settings.replayTutorial': 'Rejouer le tutoriel',
  'settings.cloud': 'Sauvegarde cloud',

  'shop.title': 'Boutique',
  'shop.boosters': 'Boosters',
  'shop.bundles': 'Offres',
  'shop.buy': 'Acheter {name} pour {price} pièces',
  'shop.bought': '{name} ajouté !',
  'shop.noCoins': 'Pas assez de pièces.',
  'shop.unavailable': 'Les achats ne sont pas encore disponibles.',

  'game.level': 'Niveau {level}',
  'game.score': 'Score {score}',
  'game.combo': 'Combo x{level}',
  'game.restart': 'Recommencer',
  'game.quit': 'Quitter',
  'game.loading': 'Chargement du niveau',
  'game.error': 'Impossible de charger ce niveau.',
  'game.retry': 'Réessayer',
  'game.tile': 'Tuile {name}, {state}',
  'game.tileFree': 'disponible',
  'game.tileBlocked': 'couverte',
  'game.tray': 'Réserve, {count} emplacements sur {size} utilisés',

  'booster.undo': 'Annuler',
  'booster.hint': 'Baguette',
  'booster.shuffle': 'Mélanger',
  'booster.left': '{name}, {count} restants',
  'booster.buy': '{name}, coûte {price} pièces',
  'booster.noCoins': 'Pas assez de pièces',
  'booster.locked': "Terminez d'abord cette étape du tutoriel",
  'booster.nothingToUndo': "Rien à annuler pour l'instant",
  'booster.nothingToShuffle': 'Rien à mélanger',
  'booster.noHint': "Aucun groupe à ramasser pour l'instant",

  'result.won': 'Niveau terminé !',
  'result.lost': 'Réserve pleine',
  'result.score': 'Score {score}',
  'result.stars': '{stars} étoiles sur 3',
  'result.coins': '+{coins} pièces',
  'result.next': 'Continuer',
  'result.retry': 'Réessayer',
  'result.map': 'Carte des niveaux',
  'result.home': 'Accueil',
  'result.leaderboard': 'Classement',
  'result.none': 'Aucun résultat à afficher.',

  'cloud.unavailable': 'Pas encore connecté',
  'cloud.idle': 'Prêt à synchroniser',
  'cloud.syncing': 'Synchronisation...',
  'cloud.synced': 'Enregistré dans le cloud',
  'cloud.offline': 'Hors ligne, nouvel essai plus tard',
  'cloud.update': "Mettez l'appli à jour pour synchroniser",
  'cloud.error': 'La synchronisation a échoué',
  'cloud.syncNow': 'Synchroniser',

  'board.title': 'Classement',
  'board.level': 'Niveau {level}',
  'board.loading': 'Chargement des scores',
  'board.empty': "Aucun score pour l'instant. Soyez le premier !",
  'board.error': 'Impossible de charger le classement.',
  'board.retry': 'Réessayer',
  'board.entry': '{rank}. {name}, {score} points, {stars} étoiles sur 3',
  'board.you': 'Vous',

  'tutorial.gotIt': 'Compris',
  'tutorial.skip': 'Passer le tutoriel',
  'tutorial.nudge': 'Touchez la tuile en surbrillance pour continuer.',
  'tutorial.l1.tap':
    "Bienvenue ! Touchez une tuile pour l'envoyer dans la réserve en bas.",
  'tutorial.l1.same': 'Touchez maintenant une autre tuile avec la même image.',
  'tutorial.l1.three':
    'Trois identiques disparaissent ! Videz toutes les tuiles pour gagner.',
  'tutorial.l2.first': 'Touchez cette tuile.',
  'tutorial.l2.wait':
    'Les images différentes attendent côte à côte dans la réserve.',
  'tutorial.l2.again': 'Touchez une autre tuile identique à la première.',
  'tutorial.l2.match':
    'Une de plus fait trois, et trois identiques disparaissent !',
  'tutorial.l3.covered':
    "Certaines tuiles sont sous d'autres. Les tuiles couvertes sont grisées et ne peuvent pas être touchées.",
  'tutorial.l3.top':
    'Touchez une tuile du dessus. Les tuiles libres peuvent être touchées.',
  'tutorial.l3.next': 'Touchez la prochaine tuile identique du dessus.',
  'tutorial.l3.last': 'Et la dernière du dessus.',
  'tutorial.l3.under':
    'Les tuiles du dessous sont libres maintenant. Continuez !',
  'tutorial.l4.capacity':
    'La réserve contient 7 tuiles. Si elle se remplit sans paire, vous perdez.',
  'tutorial.l4.pile':
    "Les images différentes s'empilent dans la réserve. Touchez ces trois-là.",
  'tutorial.l4.match': 'Touchez une tuile identique à une de la réserve.',
  'tutorial.l4.clear':
    'Touchez cette dernière tuile identique pour libérer de la place.',
  'tutorial.l5.layers':
    'Les tuiles sont empilées en couches. Commencez par celles du dessus.',
  'tutorial.l5.top': 'Touchez une tuile du dessus.',
  'tutorial.l5.more': 'Touchez les tuiles identiques du dessus.',
  'tutorial.l5.done':
    'Les tuiles du dessous sont découvertes. Terminez maintenant le niveau seul !',
  'tutorial.l6.plan':
    "Anticipez : choisissez des tuiles qui découvrent d'autres paires.",
  'tutorial.l6.pick': "Touchez d'abord cette tuile.",
  'tutorial.l6.more': 'Prenez maintenant les deux autres tuiles identiques.',
  'tutorial.l6.uncover': 'Bien joué ! Terminez maintenant le niveau seul.',
  'tutorial.l7.combo':
    'Enchaînez vite les associations pour créer un combo et gagner des points bonus !',
  'tutorial.l7.first': 'Associez ce premier groupe.',
  'tutorial.l7.quick': 'Associez vite le groupe suivant !',
  'tutorial.l7.bonus': 'Encore un pour le bonus de combo !',
  'tutorial.l8.stars':
    "Faites un gros score pour gagner jusqu'à 3 étoiles. Les associations rapides et une réserve vide donnent des points bonus.",
  'tutorial.l9.boosters':
    "Annuler, Baguette et Mélanger sont vos aides. Terminez l'entraînement pour recevoir les premières !",
  'tutorial.l10.ready':
    "Vous connaissez les bases. Videz le plateau pour terminer l'entraînement !",
};
