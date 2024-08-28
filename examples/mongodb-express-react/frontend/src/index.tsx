import { I18n } from '@perseid/core';
import { Model, Logger, ApiClient, FormBuilder, Store } from '@perseid/client';

// This is the actual data model service. It provides methods to manipulate and access data model.
// No need for a data model schema here, it will be automatically fetched from the API!
const model = new Model<DataModel>();

// The Logger service logs any useful information happening in the app, either for debugging or
// monitoring. Most services have access to this logger.
const logger = new Logger({ logLevel: 'debug' });

// Internationalization and localization service, handles labels translations and values conversions.
// No label for now, we will handle that part later on.
const i18n = new I18n(logger, {
  FIELD: {
    FALLBACK: {
      LABEL: 'N/A',
    },
    LOADING: {
      LABEL: 'Loading...',
    },
  },
  LOADER: {
    LABEL: 'Loading',
  },
  PAGINATION: {
    NEXT: 'Next',
    PREVIOUS: 'Previous',
  },
  NAVIGATION: {
    GO_BACK: 'Go back',
  },
  MENU: {
    UPDATE_USER: 'Profile',
    SIGN_OUT: 'Sign out',
    ITEMS: {
      TITLE: 'Menu'
    },
    GALAXIES: 'Galaxies',
    CELESTIAL_BODIES: 'Celestial bodies',
  },
  CONFIRM: {
    DELETE: {
      GALAXIES: {
        TITLE: 'Are you sure?',
        SUBTITLE: 'This operation cannot be undone.',
        CONFIRM: 'Delete',
        CANCEL: 'Cancel'
      },
      CELESTIAL_BODIES: {
        TITLE: 'Are you sure?',
        SUBTITLE: 'This operation cannot be undone.',
        CONFIRM: 'Delete',
        CANCEL: 'Cancel'
      }
    },
  },
  NOTIFICATIONS: {
    CREATED_RESOURCE: 'Successfully created!',
    UPDATED_USER: 'Profile updated.',
    RESET_PASSWORD: 'Password successfully reset.',
    REQUESTED_EMAIL: 'Email sent.',
    UPDATED_RESOURCE: 'Successfully updated!',
    DELETED_RESOURCE: 'Successfully deleted!',
    ERRORS: {
      UNKNOWN: 'Internal error.',
      FORBIDDEN: 'Forbidden.',
      NOT_FOUND: 'Not found.',
      USER_EXISTS: 'User already exists.',
      RESOURCE_EXISTS: 'Resource already exists.',
      RESOURCE_REFERENCED: 'Resource is used by other resources.',
      INVALID_CREDENTIALS: 'Invalid credentials.',
      INVALID_RESET_TOKEN: 'Invalid reset token.',
      INVALID_VERIFICATION_TOKEN: 'Invalid verification token.',
    },
  },
  PAGES: {
    ERROR: {
      FORBIDDEN: {
        TITLE: 'Forbidden',
        SUBTITLE: 'You are not allowed to perform this action.',
        CTA: 'Go to home',
      },
      NOT_FOUND: {
        TITLE: 'Page not found',
        SUBTITLE: "This page doesn't exist.",
        CTA: 'Go to home',
      },
      GENERIC: {
        TITLE: 'Erreur',
        SUBTITLE: 'Something went wrong.',
        CTA: 'Go to home',
      },
    },
    UPDATE_USER: {
      TITLE: 'Update my profile',
      FIELDS: {
        RESET_PASSWORD: {
          LABEL: 'Change password',
        },
        SUBMIT: {
          LABEL: 'Save',
        },
        EMAIL: {
          LABEL: 'Email',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid email.',
          },
        },
      },
    },
    VERIFY_EMAIL: {
      TITLE: 'Verify my email',
      SUBTITLE: 'Please verify your email address.',
      CTA: 'Send again',
    },
    SIGN_UP: {
      TITLE: 'Sign-up',
      SIGN_IN: 'Sign-in',
      FIELDS: {
        EMAIL: {
          LABEL: 'Email',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid email.',
          },
        },
        PASSWORD: {
          LABEL: 'Password',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid password.',
            PASSWORDS_MISMATCH: 'Passwords do not match.',
          },
        },
        PASSWORD_CONFIRMATION: {
          LABEL: 'Confirm password',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid password.',
            PASSWORDS_MISMATCH: 'Passwords do not match.',
          },
        },
        SUBMIT: {
          LABEL: 'Submit',
        },
      },
    },
    SIGN_IN: {
      TITLE: 'Sign-in',
      SIGN_UP: 'Sign-up',
      FORGOT_PASSWORD: 'Forgot password?',
      FIELDS: {
        SUBMIT: {
          LABEL: 'Submit',
        },
        EMAIL: {
          LABEL: 'Email',
          ERRORS: {
            REQUIRED: 'Field is required.',
          },
        },
        PASSWORD: {
          LABEL: 'Password',
          ERRORS: {
            REQUIRED: 'Field is required.',
          },
        },
      },
    },
    RESET_PASSWORD: {
      SIGN_IN: 'Sign-in',
      FIELDS: {
        TITLE: {
          LABEL: '# Reset my password',
        },
        EMAIL: {
          LABEL: 'Email',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid email.',
          },
        },
        PASSWORD: {
          LABEL: 'New password',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid password.',
            PASSWORDS_MISMATCH: 'Passwords do not match.',
          },
        },
        PASSWORD_CONFIRMATION: {
          LABEL: 'Confirm new password',
          ERRORS: {
            REQUIRED: 'Field is required.',
            PATTERN_VIOLATION: 'Invalid password.',
            PASSWORDS_MISMATCH: 'Passwords do not match.',
          },
        },
        SUBMIT: {
          LABEL: 'Submit',
        },
        SUCCESS_TITLE: {
          LABEL: '# Success',
        },
        SUCCESS_MESSAGE: {
          LABEL: 'Your password has been reset.',
        },
      },
    },
    GALAXIES: {
      LIST: {
        TITLE: 'Galaxies',
        SEARCH_PLACEHOLDER: 'Search for a galaxy...',
        TABLE: {
          LOADING: 'Loading...',
          ACTIONS: 'Actions',
          NO_RESULT: 'No result.',
        },
        FIELDS: {
          NAME: {
            LABEL: 'Name',
          },
          _CREATED_AT: {
            LABEL: 'Created at',
          },
          _CREATED_BY__EMAIL: {
            LABEL: 'Created by'
          },
        },
      },
      VIEW: {
        FIELDS: {
          _ID: {
            LABEL: 'ID',
          },
          NAME: {
            LABEL: 'Name',
          },
          _CREATED_AT: {
            LABEL: 'Created at',
          },
          _CREATED_BY__EMAIL: {
            LABEL: 'Created by'
          },
        },
      },
      UPDATE: {
        FIELDS: {
          NAME: {
            LABEL: 'Name',
          },
          SUBMIT: {
            LABEL: 'Save'
          }
        },
      },
      CREATE: {
        FIELDS: {
          NAME: {
            LABEL: 'Name',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          SUBMIT: {
            LABEL: 'Create'
          }
        },
      },
    },
    CELESTIAL_BODIES: {
      LIST: {
        TITLE: 'Celestial bodies',
        SEARCH_PLACEHOLDER: 'Search for a body...',
        TABLE: {
          LOADING: 'Loading...',
          ACTIONS: 'Actions',
          NO_RESULT: 'No result.',
        },
        FIELDS: {
          NAME: {
            LABEL: 'Name',
          },
          TYPE: {
            LABEL: 'Name',
          },
          DISCOVERED_IN: {
            LABEL: 'Year of discovery',
          },
          GALAXY__NAME: {
            LABEL: 'Galaxy'
          },
        },
      },
      VIEW: {
        FIELDS: {
          _ID: {
            LABEL: 'ID',
          },
          TYPE: {
            LABEL: 'Type',
          },
          NAME: {
            LABEL: 'Name',
          },
          DISCOVERED_IN: {
            LABEL: 'Year of discovery',
          },
          IS_LIFE_POSSIBLE: {
            LABEL: 'Is life possible?',
          },
          GALAXY__NAME: {
            LABEL: 'Galaxy',
          },
          COORDINATES: {
            LABEL: 'Coordinates in galaxy'
          },
          COMPOSITION: {
            LABEL: 'Body composition'
          },
        },
      },
      UPDATE: {
        FIELDS: {
          TYPE: {
            LABEL: 'Type',
            ERRORS: {
              REQUIRED: 'Field is required.',
            },
            OPTIONS: {
              PLACEHOLDER: 'Choose a type...',
              ASTEROID: 'Asteroid',
              PLANET: 'Planet',
              BACK_HOLE: 'Black hole',
              STAR: 'Star',
            }
          },
          NAME: {
            LABEL: 'Name',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          DISCOVERED_IN: {
            LABEL: 'Year of discovery',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          GALAXY: {
            LABEL: 'Galaxy',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          IS_LIFE_POSSIBLE: {
            LABEL: 'Is life possible?',
            ERRORS: {
              REQUIRED: 'Field is required.',
            },
            OPTIONS: {
              TRUE: 'Yes'
            }
          },
          COORDINATES: {
            LABEL: 'Coordinates in the galaxy',
            X: {
              LABEL: 'X',
              ERRORS: {
                REQUIRED: 'Field is required.',
              }
            },
            Y: {
              LABEL: 'Y',
              ERRORS: {
                REQUIRED: 'Field is required.',
              }
            },
          },
          COMPOSITION: {
            LABEL: 'Composition',
            SHOW: {
              LABEL: 'Composition is known'
            },
            HIDE: {
              LABEL: 'Composition is unknown'
            },
            FIELDS: {
              LABEL: 'Compositions',
              ELEMENT: {
                LABEL: 'Type of element',
                ERRORS: {
                  REQUIRED: 'Field is required.',
                }
              },
              PERCENTAGE: {
                LABEL: 'Percentage',
                ERRORS: {
                  REQUIRED: 'Field is required.',
                }
              },
            }
          },
          SUBMIT: {
            LABEL: 'Save'
          }
        },
      },
      CREATE: {
        FIELDS: {
          TYPE: {
            LABEL: 'Type',
            ERRORS: {
              REQUIRED: 'Field is required.',
            },
            OPTIONS: {
              PLACEHOLDER: 'Choose a type...',
              ASTEROID: 'Asteroid',
              PLANET: 'Planet',
              BACK_HOLE: 'Black hole',
              STAR: 'Star',
            }
          },
          NAME: {
            LABEL: 'Name',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          DISCOVERED_IN: {
            LABEL: 'Year of discovery',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          GALAXY: {
            LABEL: 'Galaxy',
            ERRORS: {
              REQUIRED: 'Field is required.',
            }
          },
          IS_LIFE_POSSIBLE: {
            LABEL: 'Is life possible?',
            ERRORS: {
              REQUIRED: 'Field is required.',
            },
            OPTIONS: {
              TRUE: 'Yes'
            }
          },
          COORDINATES: {
            LABEL: 'Coordinates in the galaxy',
            X: {
              LABEL: 'X',
              ERRORS: {
                REQUIRED: 'Field is required.',
              }
            },
            Y: {
              LABEL: 'Y',
              ERRORS: {
                REQUIRED: 'Field is required.',
              }
            },
          },
          COMPOSITION: {
            LABEL: 'Composition',
            SHOW: {
              LABEL: 'Composition is known'
            },
            HIDE: {
              LABEL: 'Composition is unknown'
            },
            FIELDS: {
              LABEL: 'Compositions',
              ELEMENT: {
                LABEL: 'Type of element',
                ERRORS: {
                  REQUIRED: 'Field is required.',
                }
              },
              PERCENTAGE: {
                LABEL: 'Percentage',
                ERRORS: {
                  REQUIRED: 'Field is required.',
                }
              },
            }
          },
          SUBMIT: {
            LABEL: 'Create'
          }
        },
      },
    },
  },
});


// The API client is the direct interface between the browser and the API server we built previously,
// so we need to specify useful endpoints paths so that the client knows which endpoint to call for
// each operation.
const apiClient = new ApiClient<DataModel>(model, logger, {
  connectTimeout: 3000,
  endpoints: {
    auth: {
      viewMe: { route: '/auth/me' },
      signUp: { route: '/auth/sign-up' },
      signIn: { route: '/auth/sign-in' },
      signOut: { route: '/auth/sign-out' },
      verifyEmail: { route: '/auth/verify-email' },
      refreshToken: { route: '/auth/refresh-token' },
      resetPassword: { route: '/auth/reset-password' },
      requestPasswordReset: { route: '/auth/reset-password' },
      requestEmailVerification: { route: '/auth/verify-email' },
    },
    resources: {
      galaxies: {
        list: { route: '/galaxies' },
        create: { route: '/galaxies' },
        view: { route: '/galaxies/:id' },
        update: { route: '/galaxies/:id' },
        delete: { route: '/galaxies/:id' },
        search: { route: '/galaxies/search' },
      },
      celestialBodies: {
        list: { route: '/bodies' },
        create: { route: '/bodies' },
        view: { route: '/bodies/:id' },
        update: { route: '/bodies/:id' },
        delete: { route: '/bodies/:id' },
        search: { route: '/bodies/search' },
      },
    },
  },
  mockedResponses: {},
  baseUrl: 'http://localhost:5070',
});

// Useful service that provides methods to easily build forms either from data model, or 100% custom.
const formBuilder = new FormBuilder<DataModel>(model, logger);

// Store is THE central element in a Perseid UI, as it handles all the app logic, including API
// calls, routing, pages data generation, ... You can see it as the front-end Engine.
const store = new Store(model, logger, apiClient, formBuilder, {
  // Here, we must configure URLS for each built-in page we want to use, as we did for endpoints.
  // This way, the app will know how to generate the UI and perform correct routing.
  pages: {
    auth: {
      signIn: { route: '/sign-in' },
      signUp: { route: '/sign-up' },
      updateUser: { route: '/users/me' },
      verifyEmail: { route: '/verify-email' },
      resetPassword: { route: '/reset-password' },
    },
    resources: {
      galaxies: {
        list: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/galaxies`.
          route: '/galaxies',
          pageProps: {
            // List of fields on which results will be searchable.
            searchFields: ['name'],
            // List of fields that will be displayed on the page.
            fields: ['_createdAt', '_createdBy.email', 'name'],
          },
        },
        view: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/galaxies/:id`.
          route: '/galaxies/:id',
          pageProps: {
            // List of fields that will be displayed on the page.
            fields: ['_id', '_createdAt', '_createdBy.email', 'name'],
          },
        },
        update: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/galaxies/:id/edit`.
          route: '/galaxies/:id/edit',
          // No special prop needed here, the edit UI will be automatically generated from data model schema!
          pageProps: {},
        },
        create: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/galaxies/create`.
          route: '/galaxies/create',
          // No special prop needed here, the creation UI will be automatically generated from data model schema!
          pageProps: {},
        },
      },
      celestialBodies: {
        list: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/bodies`.
          route: '/bodies',
          pageProps: {
            // List of fields on which results will be searchable.
            searchFields: ['name'],
            // List of fields that will be displayed on the page.
            fields: ['galaxy.name', 'name', 'type', 'discoveredIn'],
          },
        },
        view: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/bodies/:id`.
          route: '/bodies/:id',
          pageProps: {
            // List of fields that will be displayed on the page.
            fields: ['_id', 'galaxy.name', 'name', 'type', 'discoveredIn', 'isLifePossible', 'coordinates', 'composition'],
          },
        },
        update: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/bodies/:id/edit`.
          route: '/bodies/:id/edit',
          // We want to fetch an additional field: "galaxy.name", to display galaxy name instead of its ID.
          pageProps: {
            fields: ['galaxy.name']
          },
        },
        create: {
          // This page will be accessible at `http://localhost:<FRONTEND_PORT>/bodies/create`.
          route: '/bodies/create',
          // We want to fetch an additional field: "galaxy.name", to display galaxy name instead of its ID.
          pageProps: {
            fields: ['galaxy.name']
          },
        },
      }
    },
  },
  fallbackPageRoute: '/galaxies',
});

import { Router } from '@perseid/client/react';
import { createRoot, type Root } from 'react-dom/client';

window.onload = () => {
  let app: Root;

  // Registering all app routes...
  store.createRoutes();

  // Creating React root...
  const container = document.querySelector('#root') as unknown as HTMLElement;
  app = createRoot(container);
  app.render(
    // Router is the main component for any Perseid app.
    <Router
      services={{
        i18n,
        model,
        store,
        apiClient,
      }}
    />,
  );
};

import './index.scss';