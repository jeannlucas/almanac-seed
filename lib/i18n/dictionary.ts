export type Lang = "pt" | "en" | "es";

export const SUPPORTED_LANGS: Lang[] = ["pt", "en", "es"];

export const LANG_META: Record<Lang, { flag: string; label: string }> = {
  pt: { flag: "🇧🇷", label: "PT" },
  en: { flag: "🇺🇸", label: "EN" },
  es: { flag: "🇪🇸", label: "ES" },
};

export type FeatureIcon = "Upload" | "Share2" | "MessageSquarePlus";

export type Dictionary = {
  nav: {
    signIn: string;
    signOut: string;
  };
  hero: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  features: {
    title: string;
    subtitle: string;
    items: Array<{
      icon: FeatureIcon;
      title: string;
      body: string;
    }>;
  };
  footer: {
    credit: string;
  };
  login: {
    back: string;
    title: string;
    subtitle: string;
    cta: string;
    legal: string;
  };
  dashboard: {
    kicker: string;
    greetingNamed: (name: string) => string;
    greetingAnon: string;
    countZero: string;
    countOne: string;
    countMany: (n: number) => string;
    recent: string;
    recentHint: string;
    newProject: string;
    statusLabels: {
      active: string;
      published: string;
      archived: string;
    };
    emptyTitle: string;
    emptyBody: string;
    form: {
      nameLabel: string;
      namePlaceholder: string;
      htmlLabel: string;
      htmlHelper: string;
      uploadIdle: string;
      submitIdle: string;
      submitPending: string;
    };
  };
  editor: {
    ownerBadge: string;
    sharedBadge: string;
    backToDashboard: string;
    addPin: string;
    placingHint: string;
    unauthHint: string;
    errorSavePin: string;
    errorAddComment: string;
    errorUpdatePin: string;
    popover: {
      placeholder: string;
      cancel: string;
      save: string;
      saving: string;
    };
    share: {
      copy: string;
      copied: string;
    };
    sidebar: {
      titleTemplate: string;
      pinLabelTemplate: string;
      empty: string;
      statusOpen: string;
      statusResolved: string;
      member: string;
      deletedUser: string;
      replyPlaceholder: string;
      reply: string;
      saving: string;
      resolve: string;
      reopen: string;
    };
  };
};

const PT: Dictionary = {
  nav: {
    signIn: "Entrar",
    signOut: "Sair",
  },
  hero: {
    kicker: "ALMANAC",
    titleLine1: "Feedback ancorado",
    titleLine2: "em qualquer página web.",
    subtitle:
      "Sobe o HTML, compartilha o link e deixa o time colar pins exatamente onde precisa. Sem mais print no chat.",
    ctaPrimary: "Entrar com Google",
    ctaSecondary: "Como funciona",
  },
  features: {
    title: "Três passos. Zero atrito.",
    subtitle:
      "Do upload ao comentário ancorado, sem ferramenta nova pra ninguém aprender.",
    items: [
      {
        icon: "Upload",
        title: "Sobe o HTML",
        body: "Cola o markup ou faz upload do arquivo. Renderiza igualzinho num iframe sandbox isolado.",
      },
      {
        icon: "Share2",
        title: "Compartilha o link",
        body: "Link único com share_token. Manda no Slack e o time já abre a página exata pra revisar.",
      },
      {
        icon: "MessageSquarePlus",
        title: "Cola um pin",
        body: "Clica onde dói, escreve o comentário. O pin fica ancorado por coordenada relativa, responsivo.",
      },
    ],
  },
  footer: {
    credit: "Desenvolvido por BigDev.Z - IT Consulting",
  },
  login: {
    back: "Voltar para o início",
    title: "Entre na sua conta",
    subtitle: "Use sua conta Google para acessar seus projetos.",
    cta: "Entrar com Google",
    legal: "Ao continuar, você concorda em ser fantástico.",
  },
  dashboard: {
    kicker: "Dashboard",
    greetingNamed: (name) => `Olá, ${name}`,
    greetingAnon: "Olá de novo",
    countZero: "Crie seu primeiro projeto e comece a coletar feedback ancorado.",
    countOne: "Você tem 1 projeto por aqui.",
    countMany: (n) => `Você tem ${n} projetos por aqui.`,
    recent: "Projetos recentes",
    recentHint: "mais novos primeiro",
    newProject: "Novo projeto",
    statusLabels: {
      active: "ativo",
      published: "publicado",
      archived: "arquivado",
    },
    emptyTitle: "Nenhum projeto por aqui ainda.",
    emptyBody:
      "Crie seu primeiro projeto no formulário ao lado para começar a receber feedback ancorado.",
    form: {
      nameLabel: "Nome do projeto",
      namePlaceholder: "Landing page v2",
      htmlLabel: "HTML da página",
      htmlHelper:
        "Cole um documento HTML completo ou faça upload de um arquivo .html.",
      uploadIdle: "Upload .html",
      submitIdle: "Criar projeto",
      submitPending: "Criando projeto…",
    },
  },
  editor: {
    ownerBadge: "Dono",
    sharedBadge: "Visualização compartilhada",
    backToDashboard: "Voltar",
    addPin: "Adicionar pin",
    placingHint: "Clique na página…",
    unauthHint: "Entre para comentar",
    errorSavePin: "Falha ao salvar o pin",
    errorAddComment: "Falha ao comentar",
    errorUpdatePin: "Falha ao atualizar o pin",
    popover: {
      placeholder: "Deixe um comentário…",
      cancel: "Cancelar",
      save: "Salvar pin",
      saving: "Salvando…",
    },
    share: {
      copy: "Copiar link",
      copied: "Link copiado!",
    },
    sidebar: {
      titleTemplate: "Pins ({n})",
      pinLabelTemplate: "Pin {n}",
      empty: "Nenhum pin ainda. Use \"Adicionar pin\" e clique na página.",
      statusOpen: "Aberto",
      statusResolved: "Resolvido",
      member: "Membro",
      deletedUser: "Usuário removido",
      replyPlaceholder: "Responder…",
      reply: "Responder",
      saving: "Salvando…",
      resolve: "Resolver",
      reopen: "Reabrir",
    },
  },
};

const EN: Dictionary = {
  nav: {
    signIn: "Sign in",
    signOut: "Sign out",
  },
  hero: {
    kicker: "ALMANAC",
    titleLine1: "Pin-anchored feedback",
    titleLine2: "for any web page.",
    subtitle:
      "Upload the HTML, share the link, let your team drop pins exactly where it hurts. No more screenshots in chat.",
    ctaPrimary: "Sign in with Google",
    ctaSecondary: "How it works",
  },
  features: {
    title: "Three steps. Zero friction.",
    subtitle:
      "From upload to anchored comment — no new tool for anyone on the team to learn.",
    items: [
      {
        icon: "Upload",
        title: "Upload the HTML",
        body: "Paste the markup or upload the file. Renders pixel-perfect in an isolated sandboxed iframe.",
      },
      {
        icon: "Share2",
        title: "Share the link",
        body: "Unique link with share_token. Drop it in Slack and your team opens the exact same page to review.",
      },
      {
        icon: "MessageSquarePlus",
        title: "Drop a pin",
        body: "Click where it hurts, write the comment. The pin sticks via relative coordinates — responsive by design.",
      },
    ],
  },
  footer: {
    credit: "Built by BigDev.Z - IT Consulting",
  },
  login: {
    back: "Back to home",
    title: "Sign in to your account",
    subtitle: "Use your Google account to access your projects.",
    cta: "Sign in with Google",
    legal: "By continuing, you agree to be awesome.",
  },
  dashboard: {
    kicker: "Dashboard",
    greetingNamed: (name) => `Hi, ${name}`,
    greetingAnon: "Welcome back",
    countZero:
      "Create your first project and start collecting anchored feedback.",
    countOne: "You have 1 project here.",
    countMany: (n) => `You have ${n} projects here.`,
    recent: "Recent projects",
    recentHint: "newest first",
    newProject: "New project",
    statusLabels: {
      active: "active",
      published: "published",
      archived: "archived",
    },
    emptyTitle: "No projects here yet.",
    emptyBody:
      "Create your first project in the form on the side to start collecting anchored feedback.",
    form: {
      nameLabel: "Project name",
      namePlaceholder: "Landing page v2",
      htmlLabel: "Page HTML",
      htmlHelper:
        "Paste a full HTML document or upload an .html file.",
      uploadIdle: "Upload .html",
      submitIdle: "Create project",
      submitPending: "Creating project…",
    },
  },
  editor: {
    ownerBadge: "Owner",
    sharedBadge: "Shared view",
    backToDashboard: "Back",
    addPin: "Add pin",
    placingHint: "Click on page…",
    unauthHint: "Sign in to comment",
    errorSavePin: "Failed to save pin",
    errorAddComment: "Failed to comment",
    errorUpdatePin: "Failed to update pin",
    popover: {
      placeholder: "Leave a comment…",
      cancel: "Cancel",
      save: "Save pin",
      saving: "Saving…",
    },
    share: {
      copy: "Copy link",
      copied: "Link copied!",
    },
    sidebar: {
      titleTemplate: "Pins ({n})",
      pinLabelTemplate: "Pin {n}",
      empty: "No pins yet. Use \"Add pin\" and click on the page.",
      statusOpen: "Open",
      statusResolved: "Resolved",
      member: "Member",
      deletedUser: "Deleted user",
      replyPlaceholder: "Reply…",
      reply: "Reply",
      saving: "Saving…",
      resolve: "Resolve",
      reopen: "Reopen",
    },
  },
};

const ES: Dictionary = {
  nav: {
    signIn: "Entrar",
    signOut: "Salir",
  },
  hero: {
    kicker: "ALMANAC",
    titleLine1: "Feedback anclado",
    titleLine2: "en cualquier página web.",
    subtitle:
      "Sube el HTML, comparte el enlace y deja que tu equipo coloque pins exactamente donde duele. Sin más capturas en el chat.",
    ctaPrimary: "Entrar con Google",
    ctaSecondary: "Cómo funciona",
  },
  features: {
    title: "Tres pasos. Cero fricción.",
    subtitle:
      "Del upload al comentario anclado, sin herramienta nueva para que nadie tenga que aprender.",
    items: [
      {
        icon: "Upload",
        title: "Sube el HTML",
        body: "Pega el markup o sube el archivo. Se renderiza idéntico en un iframe sandbox aislado.",
      },
      {
        icon: "Share2",
        title: "Comparte el enlace",
        body: "Enlace único con share_token. Mándalo por Slack y el equipo abre la página exacta para revisar.",
      },
      {
        icon: "MessageSquarePlus",
        title: "Coloca un pin",
        body: "Haz clic donde duele, escribe el comentario. El pin queda anclado por coordenada relativa, responsivo.",
      },
    ],
  },
  footer: {
    credit: "Desarrollado por BigDev.Z - IT Consulting",
  },
  login: {
    back: "Volver al inicio",
    title: "Entra en tu cuenta",
    subtitle: "Usa tu cuenta de Google para acceder a tus proyectos.",
    cta: "Entrar con Google",
    legal: "Al continuar, aceptas ser fantástico.",
  },
  dashboard: {
    kicker: "Dashboard",
    greetingNamed: (name) => `Hola, ${name}`,
    greetingAnon: "Bienvenido de nuevo",
    countZero:
      "Crea tu primer proyecto y empieza a recoger feedback anclado.",
    countOne: "Tienes 1 proyecto por aquí.",
    countMany: (n) => `Tienes ${n} proyectos por aquí.`,
    recent: "Proyectos recientes",
    recentHint: "los más nuevos primero",
    newProject: "Nuevo proyecto",
    statusLabels: {
      active: "activo",
      published: "publicado",
      archived: "archivado",
    },
    emptyTitle: "Todavía no hay proyectos por aquí.",
    emptyBody:
      "Crea tu primer proyecto en el formulario al lado para empezar a recibir feedback anclado.",
    form: {
      nameLabel: "Nombre del proyecto",
      namePlaceholder: "Landing page v2",
      htmlLabel: "HTML de la página",
      htmlHelper:
        "Pega un documento HTML completo o sube un archivo .html.",
      uploadIdle: "Subir .html",
      submitIdle: "Crear proyecto",
      submitPending: "Creando proyecto…",
    },
  },
  editor: {
    ownerBadge: "Dueño",
    sharedBadge: "Vista compartida",
    backToDashboard: "Volver",
    addPin: "Añadir pin",
    placingHint: "Haz clic en la página…",
    unauthHint: "Entra para comentar",
    errorSavePin: "Error al guardar el pin",
    errorAddComment: "Error al comentar",
    errorUpdatePin: "Error al actualizar el pin",
    popover: {
      placeholder: "Deja un comentario…",
      cancel: "Cancelar",
      save: "Guardar pin",
      saving: "Guardando…",
    },
    share: {
      copy: "Copiar enlace",
      copied: "¡Enlace copiado!",
    },
    sidebar: {
      titleTemplate: "Pins ({n})",
      pinLabelTemplate: "Pin {n}",
      empty: "Todavía no hay pins. Usa \"Añadir pin\" y haz clic en la página.",
      statusOpen: "Abierto",
      statusResolved: "Resuelto",
      member: "Miembro",
      deletedUser: "Usuario eliminado",
      replyPlaceholder: "Responder…",
      reply: "Responder",
      saving: "Guardando…",
      resolve: "Resolver",
      reopen: "Reabrir",
    },
  },
};

export const dictionary: Record<Lang, Dictionary> = {
  pt: PT,
  en: EN,
  es: ES,
};

export function isLang(value: unknown): value is Lang {
  return value === "pt" || value === "en" || value === "es";
}
