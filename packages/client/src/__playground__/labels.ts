/* c8 ignore start */

export default {
  FIELD: {
    FALLBACK: {
      LABEL: 'Non disponible',
    },
    LOADING: {
      LABEL: 'Chargement...',
    },
  },
  LOADER: {
    LABEL: 'Chargement',
  },
  PAGINATION: {
    NEXT: 'Suivant',
    PREVIOUS: 'Précédent',
  },
  NAVIGATION: {
    GO_BACK: 'Retour',
  },
  MENU: {
    ITEMS: {
      TITLE: 'Articles',
    },
    UPDATE_USER: "Mettre à jour l'utilisateur",
    SIGN_OUT: 'Se déconnecter',
    USERS: 'Utilisateurs',
    TESTS: 'Tests',
  },
  CONFIRM: {
    DELETE: {
      TESTS: {
        TITLE: 'Confirmer la suppression',
        SUBTITLE: 'Êtes-vous sûr de vouloir supprimer cette resource ?',
        CONFIRM: 'Confirmer',
        CANCEL: 'Annuler',
      },
    },
  },
  NOTIFICATIONS: {
    UPDATED_USER: 'Utilisateur mis à jour',
    RESET_PASSWORD: 'Réinitialiser le mot de passe',
    REQUESTED_EMAIL: 'E-mail demandé',
    UPDATED_RESOURCE: 'Ressource mise à jour',
    DELETED_RESOURCE: 'Ressource supprimée',
    ERRORS: {
      UNKNOWN: 'Erreur inconnue',
      FORBIDDEN: 'Interdit',
      NOT_FOUND: 'Non trouvé',
      USER_EXISTS: "L'utilisateur existe déjà",
      RESOURCE_EXISTS: 'La ressource existe déjà',
      RESOURCE_REFERENCED: 'Ressource référencée',
      INVALID_CREDENTIALS: 'Identifiants non valides',
      INVALID_RESET_TOKEN: 'Jeton de réinitialisation non valide',
      INVALID_VERIFICATION_TOKEN: 'Jeton de vérification non valide',
    },
  },
  PAGES: {
    ERROR: {
      FORBIDDEN: {
        TITLE: 'Interdit',
        SUBTITLE: "Vous n'avez pas la permission",
        CTA: "Retour à l'accueil",
      },
      NOT_FOUND: {
        TITLE: 'Page non trouvée',
        SUBTITLE: "Cette page n'existe pas",
        CTA: "Retour à l'accueil",
      },
      GENERIC: {
        TITLE: 'Erreur',
        SUBTITLE: "Quelque chose s'est mal passé",
        CTA: "Retour à l'accueil",
      },
    },
    UPDATE_USER: {
      TITLE: "Mettre à jour l'utilisateur",
      FIELDS: {
        RESET_PASSWORD: {
          LABEL: 'Change password',
        },
        SUBMIT: {
          LABEL: 'Save',
        },
        EMAIL: {
          LABEL: 'E-mail',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: "Format d'e-mail non valide",
          },
        },
      },
    },
    VERIFY_EMAIL: {
      TITLE: "Vérifier l'e-mail",
      SUBTITLE: 'Veuillez vérifier votre e-mail',
      CTA: 'Envoyer à nouveau',
    },
    SIGN_UP: {
      TITLE: 'Inscription',
      SIGN_IN: 'Se connecter',
      FIELDS: {
        EMAIL: {
          LABEL: 'E-mail',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: "Format d'e-mail non valide",
          },
        },
        PASSWORD: {
          LABEL: 'Mot de passe',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: 'Mot de passe non valide',
            PASSWORDS_MISMATCH: 'Mots de passe différents',
          },
        },
        PASSWORD_CONFIRMATION: {
          LABEL: 'Confirmer le mot de passe',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: 'Mot de passe non valide',
            PASSWORDS_MISMATCH: 'Mots de passe différents',
          },
        },
        SUBMIT: {
          LABEL: 'Soumettre',
        },
      },
    },
    SIGN_IN: {
      TITLE: 'Se connecter',
      SIGN_UP: 'Inscription',
      FORGOT_PASSWORD: 'Mot de passe oublié',
      FIELDS: {
        SUBMIT: {
          LABEL: 'Soumettre',
        },
        EMAIL: {
          LABEL: 'E-mail',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
          },
        },
        PASSWORD: {
          LABEL: 'Mot de passe',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
          },
        },
      },
    },
    RESET_PASSWORD: {
      SIGN_IN: 'Se connecter',
      FIELDS: {
        TITLE: {
          LABEL: '# Réinitialiser le mot de passe',
        },
        EMAIL: {
          LABEL: 'E-mail',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: "Format d'e-mail non valide",
          },
        },
        PASSWORD: {
          LABEL: 'Nouveau mot de passe',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: 'Mot de passe non valide',
            PASSWORDS_MISMATCH: 'Mots de passe différents',
          },
        },
        PASSWORD_CONFIRMATION: {
          LABEL: 'Confirmer le nouveau mot de passe',
          ERRORS: {
            REQUIRED: 'Champ obligatoire',
            PATTERN_VIOLATION: 'Mot de passe non valide',
            PASSWORDS_MISMATCH: 'Mots de passe différents',
          },
        },
        SUBMIT: {
          LABEL: 'Soumettre',
        },
        SUCCESS_TITLE: {
          LABEL: 'Réussite',
        },
        SUCCESS_MESSAGE: {
          LABEL: 'Votre mot de passe a été réinitialisé',
        },
      },
    },
    USERS: {
      VIEW: {
        FIELDS: {
          _CREATED_AT: {
            LABEL: 'Créé à',
          },
          ROLES___CREATED_BY__EMAIL: {
            LABEL: 'E-mail du créateur',
          },
          _DEVICES: {
            LABEL: 'Appareils',
          },
          PASSWORD: {
            LABEL: 'Mot de passe',
          },
          _API_KEYS: {
            LABEL: 'Clés API',
          },
          _VERIFIED_AT: {
            LABEL: 'Vérifié à',
          },
        },
      },
      CREATE: {
        FIELDS: {
          SUBMIT: {
            LABEL: 'Soumettre',
          },
          EMAIL: {
            LABEL: 'E-mail',
            ERRORS: {
              REQUIRED: 'Champ obligatoire',
              PATTERN_VIOLATION: "Format d'e-mail non valide",
            },
          },
          PASSWORD: {
            LABEL: 'Mot de passe',
            ERRORS: {
              REQUIRED: 'Champ obligatoire',
              PATTERN_VIOLATION: 'Mot de passe non valide',
            },
          },
          ROLES: {
            LABEL: 'Rôles',
            FIELDS: {
              LABEL: 'Étiquette',
              ERRORS: {
                REQUIRED: 'Champ obligatoire',
              },
            },
          },
        },
      },
      UPDATE: {
        FIELDS: {
          SUBMIT: {
            LABEL: 'Soumettre',
          },
          EMAIL: {
            LABEL: 'E-mail',
            PLACEHOLDER: 'azd@zad;com',
            ERRORS: {
              REQUIRED: 'Champ obligatoire',
              PATTERN_VIOLATION: "Format d'e-mail non valide",
            },
          },
          PASSWORD: {
            LABEL: 'Mot de passe',
            ERRORS: {
              REQUIRED: 'Champ obligatoire',
              PATTERN_VIOLATION: 'Mot de passe non valide',
            },
          },
          ROLES: {
            LABEL: 'Rôles',
            FIELDS: {
              LABEL: 'Étiquette',
              ERRORS: {
                REQUIRED: 'Champ obligatoire',
              },
            },
          },
        },
      },
      LIST: {
        TITLE: 'Utilisateurs',
        TABLE: {
          LOADING: 'Chargement',
          ACTIONS: 'Actions',
          NO_RESULT: 'Aucun résultat',
        },
        FIELDS: {
          _DEVICES: {
            LABEL: 'Devices',
          },
          _API_KEYS: {
            LABEL: 'Clés API',
          },
          _VERIFIED_AT: {
            LABEL: 'Vérifié à',
          },
          _CREATED_AT: {
            LABEL: 'Créé à',
          },
          EMAIL: {
            LABEL: 'E-mail',
          },
          ROLES___CREATED__BY___UPDATEDBY: {
            LABEL: 'Rôles',
          },
        },
        SEARCH_PLACEHOLDER: 'Recherche...',
      },
    },
    TESTS: {
      VIEW: {
        FIELDS: {
          _CREATED_AT: {
            LABEL: 'Créé à',
          },
          _CREATED_BY__EMAIL: {
            LABEL: 'E-mail du créateur',
          },
          ELEMENTS: {
            LABEL: 'Elements',
          },
        },
      },
      CREATE: {
        FIELDS: {
          SUBMIT: {
            LABEL: 'Soumettre',
          },
          ELEMENTS: {
            LABEL: 'Elements',
            SHOW: {
              LABEL: 'Afficher',
            },
            HIDE: {
              LABEL: 'Masquer',
            },
            FIELDS: {
              LABEL: 'Étiquette',
              CHILD: {
                LABEL: 'Enfant',
              },
            },
          },
        },
      },
      UPDATE: {
        FIELDS: {
          SUBMIT: {
            LABEL: 'Soumettre',
          },
          ELEMENTS: {
            LABEL: 'Elements',
            SHOW: {
              LABEL: 'Afficher',
            },
            HIDE: {
              LABEL: 'Masquer',
            },
            FIELDS: {
              LABEL: 'Étiquette',
              CHILD: {
                LABEL: 'Enfant',
              },
            },
          },
        },
      },
      LIST: {
        TITLE: 'Tests',
        TABLE: {
          LOADING: 'Chargement',
          ACTIONS: 'Actions',
          NO_RESULT: 'Aucun résultat',
        },
        FIELDS: {
          _CREATED_AT: {
            LABEL: 'Créé à',
          },
          ELEMENTS: {
            LABEL: 'Elements',
            FIELDS: {
              LABEL: 'Étiquette',
              CHILD: {
                LABEL: 'Enfant',
              },
            },
          },
          _CREATED_BY__EMAIL: {
            LABEL: 'Créé par',
          },
        },
      },
    },
  },
};
