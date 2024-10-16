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
    ROLES: 'Roles',
    TEST: 'Test',
    OTHER_TEST: 'Other test',
  },
  CONFIRM: {
    DELETE: {
      TEST: {
        TITLE: 'Confirmer la suppression',
        SUBTITLE: 'Êtes-vous sûr de vouloir supprimer cette ressource ?',
        CONFIRM: 'Confirmer',
        CANCEL: 'Annuler',
      },
      OTHER_TEST: {
        TITLE: 'Confirmer la suppression',
        SUBTITLE: 'Êtes-vous sûr de vouloir supprimer cette ressource ?',
        CONFIRM: 'Confirmer',
        CANCEL: 'Annuler',
      },
      ROLES: {
        TITLE: 'Confirmer la suppression',
        SUBTITLE: 'Êtes-vous sûr de vouloir supprimer cette ressource ?',
        CONFIRM: 'Confirmer',
        CANCEL: 'Annuler',
      },
      USERS: {
        TITLE: 'Confirmer la suppression',
        SUBTITLE: 'Êtes-vous sûr de vouloir supprimer cette ressource ?',
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
    CREATED_RESOURCE: 'Ressource créée!',
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
          ROLES: {
            FIELDS: {
              _CREATED_BY: {
                FIELDS: {
                  EMAIL: {
                    LABEL: 'Rôles créé par',
                  },
                },
              },
            },
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
          ROLES: {
            FIELDS: {
              _CREATED_BY: {
                FIELDS: {
                  _UPDATED_BY: {
                    LABEL: 'Rôles créé par',
                  },
                },
              },
            },
          },
        },
        SEARCH_PLACEHOLDER: 'Recherche...',
      },
    },
    ROLES: {
      LIST: {
        TITLE: 'Roles',
        TABLE: {
          LOADING: 'Chargement',
          ACTIONS: 'Actions',
          NO_RESULT: 'Aucun résultat',
        },
        FIELDS: {
          NAME: {
            LABEL: 'Nom',
          },
        },
        SEARCH_PLACEHOLDER: 'Recherche...',
      },
      VIEW: {
        FIELDS: {
          _CREATED_AT: {
            LABEL: 'Créé à',
          },
          _CREATED_BY: {
            LABEL: 'Créateur',
          },
          NAME: {
            LABEL: 'Nom',
          },
          PERMISSIONS: {
            LABEL: 'Permissions',
          },
        },
      },
      UPDATE: {
        FIELDS: {
          NAME: {
            LABEL: 'Nom',
            ERRORS: {
              REQUIRED: 'Champ requis',
              PATTERN_VIOLATION: 'Nom invalide',
            },
          },
          PERMISSIONS: {
            LABEL: 'Permissions',
            FIELDS: {
              LABEL: 'Nom de la permission',
              ERRORS: {
                REQUIRED: 'Champ requis',
                PATTERN_VIOLATION: 'Nom invalide',
              },
            },
          },
          SUBMIT: {
            LABEL: 'Soumettre',
          },
        },
      },
      CREATE: {
        FIELDS: {
          NAME: {
            LABEL: 'Nom',
            ERRORS: {
              REQUIRED: 'Champ requis',
              PATTERN_VIOLATION: 'Nom invalide',
            },
          },
          PERMISSIONS: {
            LABEL: 'Permissions',
            FIELDS: {
              LABEL: 'Nom de la permission',
              ERRORS: {
                REQUIRED: 'Champ requis',
                PATTERN_VIOLATION: 'Nom invalide',
              },
            },
          },
          SUBMIT: {
            LABEL: 'Soumettre',
          },
        },
      },
    },
    TEST: {
      VIEW: {
        FIELDS: {
          _CREATED_AT: {
            LABEL: 'Créé à',
          },
          OBJECT_ONE: {
            FIELDS: {
              BOOLEAN: {
                LABEL: 'Booléen',
              },
            },
          },
          _CREATED_BY: {
            FIELDS: {
              EMAIL: {
                LABEL: 'Créé par',
              },
            },
          },
        },
      },
      CREATE: {
        FIELDS: {
          INDEXED_STRING: {
            LABEL: 'Champ indexé',
            ERRORS: {
              REQUIRED: 'Champ requis',
            },
          },
          OBJECT_ONE: {
            LABEL: 'Object 1',
            FIELDS: {
              BOOLEAN: {
                LABEL: 'Booléen',
                OPTIONS: {
                  TRUE: 'Vrai',
                },
                ERRORS: {
                  REQUIRED: 'Champ requis',
                },
              },
              OBJECT_TWO: {
                LABEL: 'Objet 2',
                FIELDS: {
                  OPTIONAL_INDEXED_STRING: {
                    LABEL: 'Champ indexé optionnel',
                  },
                  OPTIONAL_NESTED_ARRAY: {
                    LABEL: 'Tableau imbriqué optionnel',
                    SHOW: {
                      LABEL: 'Montrer le tableau imbriqué optionnel',
                    },
                    HIDE: {
                      LABEL: 'Supprimer le tableau imbriqué optionnel',
                    },
                    FIELDS: {
                      LABEL: 'Champ',
                      SHOW: {
                        LABEL: 'Créer le champ',
                      },
                      HIDE: {
                        LABEL: 'Supprimer le champ',
                      },
                      FIELDS: {
                        DATA: {
                          LABEL: 'Données',
                          FIELDS: {
                            OPTIONAL_INTEGER: {
                              LABEL: 'Entier optionnel',
                            },
                            FLAT_ARRAY: {
                              LABEL: 'Liste de champs',
                              FIELDS: {
                                LABEL: 'Champ',
                              },
                            },
                            NESTED_ARRAY: {
                              LABEL: 'Champs imbriqués',
                              FIELDS: {
                                LABEL: 'Champ imbriqué',
                                FIELDS: {
                                  OPTIONAL_RELATION: {
                                    LABEL: 'Relation optionnelle',
                                  },
                                  KEY: {
                                    LABEL: 'Clé',
                                    ERRORS: {
                                      REQUIRED: 'Champ requis',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              OPTIONAL_RELATIONS: {
                LABEL: 'Relations optionelles',
                FIELDS: {
                  LABEL: 'Relation',
                },
                SHOW: {
                  LABEL: 'Créer les relations optionelles',
                },
                HIDE: {
                  LABEL: 'Supprimer les relations optionelles',
                },
              },
            },
          },
          SUBMIT: {
            LABEL: 'Soumettre',
          },
        },
      },
      UPDATE: {
        FIELDS: {
          INDEXED_STRING: {
            LABEL: 'Champ indexé',
            ERRORS: {
              REQUIRED: 'Champ requis',
            },
          },
          OBJECT_ONE: {
            LABEL: 'Object 1',
            FIELDS: {
              BOOLEAN: {
                LABEL: 'Booléen',
                OPTIONS: {
                  TRUE: 'Vrai',
                },
                ERRORS: {
                  REQUIRED: 'Champ requis',
                },
              },
              OBJECT_TWO: {
                LABEL: 'Objet 2',
                FIELDS: {
                  OPTIONAL_INDEXED_STRING: {
                    LABEL: 'Champ indexé optionnel',
                  },
                  OPTIONAL_NESTED_ARRAY: {
                    LABEL: 'Tableau imbriqué optionnel',
                    SHOW: {
                      LABEL: 'Montrer le tableau imbriqué optionnel',
                    },
                    HIDE: {
                      LABEL: 'Supprimer le tableau imbriqué optionnel',
                    },
                    FIELDS: {
                      LABEL: 'Champ',
                      SHOW: {
                        LABEL: 'Créer le champ',
                      },
                      HIDE: {
                        LABEL: 'Supprimer le champ',
                      },
                      FIELDS: {
                        DATA: {
                          LABEL: 'Données',
                          FIELDS: {
                            OPTIONAL_INTEGER: {
                              LABEL: 'Entier optionnel',
                            },
                            FLAT_ARRAY: {
                              LABEL: 'Liste de champs',
                              FIELDS: {
                                LABEL: 'Champ',
                              },
                            },
                            NESTED_ARRAY: {
                              LABEL: 'Champs imbriqués',
                              FIELDS: {
                                LABEL: 'Champ imbriqué',
                                FIELDS: {
                                  OPTIONAL_RELATION: {
                                    LABEL: 'Relation optionnelle',
                                  },
                                  KEY: {
                                    LABEL: 'Clé',
                                    ERRORS: {
                                      REQUIRED: 'Champ requis',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              OPTIONAL_RELATIONS: {
                LABEL: 'Relations optionelles',
                FIELDS: {
                  LABEL: 'Relation',
                },
                SHOW: {
                  LABEL: 'Créer les relations optionelles',
                },
                HIDE: {
                  LABEL: 'Supprimer les relations optionelles',
                },
              },
            },
          },
          SUBMIT: {
            LABEL: 'Soumettre',
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
          OBJECT_ONE: {
            FIELDS: {
              BOOLEAN: {
                LABEL: 'Booléen',
              },
            },
          },
          _CREATED_BY: {
            FIELDS: {
              EMAIL: {
                LABEL: 'Créé par',
              },
            },
          },
        },
      },
    },
    OTHER_TEST: {
      LIST: {
        TITLE: 'Other tests',
        TABLE: {
          LOADING: 'Chargement',
          ACTIONS: 'Actions',
          NO_RESULT: 'Aucun résultat',
        },
        FIELDS: {
          ENUM: {
            LABEL: 'Énumération',
          },
          _CREATED_AT: {
            LABEL: 'Créé le',
          },
          DATA: {
            FIELDS: {
              OPTIONAL_FLAT_ARRAY: {
                LABEL: 'Liste optionnelle',
              },
            },
          },
        },
      },
      VIEW: {
        FIELDS: {
          ENUM: {
            LABEL: 'Énumération',
          },
          _CREATED_AT: {
            LABEL: 'Créé le',
          },
          DATA: {
            FIELDS: {
              OPTIONAL_FLAT_ARRAY: {
                LABEL: 'Liste optionnelle',
              },
            },
          },
        },
      },
      UPDATE: {
        FIELDS: {
          BINARY: {
            LABEL: 'Fichier',
            ERRORS: {
              REQUIRED: 'Champ requis',
            },
          },
          ENUM: {
            LABEL: 'Énumération',
            PLACEHOLDER: 'Sélectionner...',
            OPTIONS: {
              ONE: 'Option 1',
              TWO: 'Option 2',
              THREE: 'Option 3',
            },
            ERRORS: {
              REQUIRED: 'Champ requis',
            },
          },
          OPTIONAL_RELATION: {
            LABEL: 'Relation optionnelle',
          },
          DATA: {
            LABEL: 'Données',
            FIELDS: {
              OPTIONAL_RELATION: {
                LABEL: 'Relation optionnelle',
              },
              OPTIONAL_FLAT_ARRAY: {
                LABEL: "Liste d'options",
                SHOW: {
                  LABEL: 'Créer une liste optionelle',
                },
                HIDE: {
                  LABEL: 'Supprimer la liste optionelle',
                },
                FIELDS: {
                  LABEL: 'Option',
                  PLACEHOLDER: 'Sélectionner...',
                  OPTIONS: {
                    TEST1: 'Test 1',
                    TEST2: 'Test 2',
                    TEST3: 'Test 3',
                    TEST4: 'Test 4',
                    TEST5: 'Test 5',
                  },
                },
              },
            },
          },
          SUBMIT: {
            LABEL: 'Soumettre',
          },
        },
      },
      CREATE: {
        FIELDS: {
          BINARY: {
            LABEL: 'Fichier',
            ERRORS: {
              REQUIRED: 'Champ requis',
            },
          },
          ENUM: {
            LABEL: 'Énumération',
            PLACEHOLDER: 'Sélectionner...',
            OPTIONS: {
              ONE: 'Option 1',
              TWO: 'Option 2',
              THREE: 'Option 3',
            },
            ERRORS: {
              REQUIRED: 'Champ requis',
            },
          },
          OPTIONAL_RELATION: {
            LABEL: 'Relation optionnelle',
          },
          DATA: {
            LABEL: 'Données',
            FIELDS: {
              OPTIONAL_RELATION: {
                LABEL: 'Relation optionnelle',
              },
              OPTIONAL_FLAT_ARRAY: {
                LABEL: "Liste d'options",
                SHOW: {
                  LABEL: 'Créer une liste optionelle',
                },
                HIDE: {
                  LABEL: 'Supprimer la liste optionelle',
                },
                FIELDS: {
                  LABEL: 'Option',
                  PLACEHOLDER: 'Sélectionner...',
                  OPTIONS: {
                    TEST1: 'Test 1',
                    TEST2: 'Test 2',
                    TEST3: 'Test 3',
                    TEST4: 'Test 4',
                    TEST5: 'Test 5',
                  },
                },
              },
            },
          },
          SUBMIT: {
            LABEL: 'Soumettre',
          },
        },
      },
    },
  },
};
