export interface BusinessTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  botGoal: string;
  tone: string;
  welcomeMessage: string;
  fallbackMessage: string;
  handoffMessage: string;
  faqs: string[];
  suggestedCategories: string[];
  commercialIntents: string[];
  recommendedFields: string[];
  comingSoon?: boolean;
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: "tech_store",
    name: "Tienda de celulares / tecnología",
    emoji: "📱",
    description: "Para negocios que venden celulares, accesorios, equipos usados, reacondicionados o servicio técnico.",
    botGoal:
      "Soy el asistente de una tienda especializada en venta de celulares, accesorios y servicio técnico. Respondo consultas sobre modelos disponibles, precios, stock, financiación, cuotas, métodos de pago, garantías y envíos. Cuando el cliente muestra intención clara de compra, lo derivo con un asesor.",
    tone: "Claro, moderno, comercial y breve.",
    welcomeMessage:
      "Hola, gracias por escribirnos. Puedo ayudarte con modelos disponibles, precios, formas de pago, envíos y garantías. ¿Qué equipo estás buscando?",
    fallbackMessage:
      "Esa información no la tengo cargada todavía. Te derivo con un asesor para que te ayude mejor.",
    handoffMessage:
      "Te paso con una persona del equipo para que pueda ayudarte con más detalle.",
    faqs: [
      "¿Qué modelos tienen disponibles?",
      "¿Aceptan transferencia?",
      "¿Tienen cuotas?",
      "¿Hacen envíos?",
      "¿Los equipos tienen garantía?",
      "¿Toman usados en parte de pago?",
      "¿Dónde están ubicados?",
      "¿Cuál es el horario de atención?",
    ],
    suggestedCategories: [
      "iPhone",
      "Samsung",
      "Otros celulares",
      "Accesorios",
      "Usados seleccionados",
      "Reacondicionados",
      "Servicio técnico",
    ],
    commercialIntents: [
      "precio",
      "stock",
      "financiación",
      "cuotas",
      "envío",
      "garantía",
      "reservar",
      "comprar",
      "hablar con vendedor",
    ],
    recommendedFields: [
      "Horarios de atención",
      "Dirección / ubicación",
      "Medios de pago aceptados",
      "Política de garantía",
      "Formas de envío y costo",
      "Política de cambios y devoluciones",
    ],
  },
  {
    id: "clothing",
    name: "Indumentaria",
    emoji: "👕",
    description: "Para tiendas de ropa, calzado y accesorios que necesitan responder sobre talles, colores, envíos y stock.",
    botGoal:
      "Soy el asistente de una tienda de indumentaria. Respondo sobre disponibilidad de talles y colores, stock, precios, envíos, retiros en tienda, métodos de pago y política de cambios. Ayudo al cliente a encontrar lo que busca según talle y estilo.",
    tone: "Amigable, cercano y resolutivo.",
    welcomeMessage:
      "Hola, bienvenido/a. Puedo ayudarte con talles disponibles, colores, precios y envíos. ¿Qué prenda estás buscando?",
    fallbackMessage:
      "No tengo esa información a mano. Te conecto con alguien del equipo para ayudarte.",
    handoffMessage: "Te paso con una persona del equipo para que te asesore mejor.",
    faqs: [
      "¿Qué talles tienen disponibles?",
      "¿Hacen envíos?",
      "¿Tienen retiro en tienda?",
      "¿Aceptan cambios?",
      "¿Cuánto tarda el envío?",
      "¿Tienen guía de talles?",
      "¿Aceptan tarjeta?",
      "¿Hay descuentos por cantidad?",
      "¿Tienen catálogo online?",
    ],
    suggestedCategories: [
      "Remeras",
      "Pantalones",
      "Vestidos",
      "Calzado",
      "Accesorios",
      "Ropa deportiva",
      "Temporada actual",
    ],
    commercialIntents: [
      "talle",
      "color",
      "stock",
      "envío",
      "precio",
      "comprar",
      "cambio",
      "devolver",
    ],
    recommendedFields: [
      "Horarios de atención",
      "Dirección (si hay local físico)",
      "Medios de pago aceptados",
      "Política de cambios y devoluciones",
      "Tiempo de entrega",
      "Enlace al catálogo (si existe)",
    ],
  },
  {
    id: "hair_salon",
    name: "Peluquería / estética",
    emoji: "✂️",
    description: "Para peluquerías, barberías y centros de estética que gestionan turnos y consultas de servicios.",
    botGoal:
      "Soy el asistente de una peluquería o centro de estética. Gestiono consultas sobre turnos, servicios disponibles, precios, duración aproximada, disponibilidad y cómo reservar. Informo sobre la política de cancelaciones y recomendaciones previas al turno.",
    tone: "Cálido, profesional y atento.",
    welcomeMessage:
      "Hola, gracias por escribirnos. Puedo ayudarte a reservar un turno o consultarte sobre nuestros servicios y precios. ¿En qué te puedo ayudar?",
    fallbackMessage:
      "No tengo esa información disponible. Te comunico con alguien del equipo.",
    handoffMessage: "Te paso con una persona del equipo para coordinar mejor.",
    faqs: [
      "¿Cuáles son los servicios disponibles?",
      "¿Cuánto cuesta un corte?",
      "¿Cómo reservo un turno?",
      "¿Cuándo tienen disponibilidad?",
      "¿Cuánto dura la cita?",
      "¿Hay que dejar seña?",
      "¿Cómo cancelo o cambio mi turno?",
      "¿Dónde están ubicados?",
      "¿Cuál es el horario de atención?",
    ],
    suggestedCategories: [
      "Corte de pelo",
      "Coloración",
      "Mechas",
      "Tratamientos capilares",
      "Manicuría / Pedicuría",
      "Depilación",
      "Peinados especiales",
    ],
    commercialIntents: [
      "turno",
      "reservar",
      "precio",
      "disponibilidad",
      "cuando",
      "costo",
      "seña",
    ],
    recommendedFields: [
      "Horarios de atención",
      "Dirección",
      "Cómo reservar un turno (WhatsApp, IG, web)",
      "Política de cancelaciones (con cuánta anticipación)",
      "Si se requiere seña y monto",
      "Recomendaciones previas al turno",
    ],
  },
  {
    id: "restaurant",
    name: "Restaurante / comida",
    emoji: "🍽️",
    description: "Para restaurantes, rotiserías, hamburgueserías o negocios de delivery que reciben pedidos y consultas.",
    botGoal:
      "Soy el asistente de un restaurante o negocio de comida. Respondo sobre el menú, precios, pedidos para delivery o take away, horarios, reservas para comer en el local, medios de pago y consultas especiales sobre ingredientes o alergias.",
    tone: "Amable, directo y con onda.",
    welcomeMessage:
      "Hola, gracias por escribirnos. Puedo ayudarte con nuestro menú, precios, delivery o reservas. ¿Qué necesitás?",
    fallbackMessage:
      "Esa consulta es mejor que te la responda alguien del equipo. Te paso enseguida.",
    handoffMessage: "Te conecto con una persona para ayudarte.",
    faqs: [
      "¿Cuál es el menú?",
      "¿Hacen delivery?",
      "¿Cuánto tarda el pedido?",
      "¿Tienen take away?",
      "¿Se puede reservar mesa?",
      "¿Cuáles son los horarios?",
      "¿Aceptan tarjeta?",
      "¿Qué platos recomiendan?",
      "¿Tienen opciones vegetarianas o veganas?",
      "¿Hacen pedidos por acá?",
    ],
    suggestedCategories: [
      "Entradas",
      "Platos principales",
      "Bebidas",
      "Postres",
      "Menú del día",
      "Para compartir",
      "Opciones especiales",
    ],
    commercialIntents: [
      "menú",
      "precio",
      "delivery",
      "pedir",
      "reservar",
      "mesa",
      "horario",
      "promoción",
    ],
    recommendedFields: [
      "Horarios de atención y cocina",
      "Dirección del local",
      "Zona de cobertura para delivery",
      "Medios de pago aceptados",
      "Teléfono para reservas",
      "Enlace al menú completo (si existe)",
    ],
  },
  {
    id: "events",
    name: "Eventos / boliche",
    emoji: "🎉",
    description: "Para organizadores de eventos, boliches, bares o productoras que venden entradas y gestionan reservas.",
    botGoal:
      "Soy el asistente de un negocio de eventos o entretenimiento nocturno. Respondo sobre entradas disponibles, precios, sectores VIP, reservas de mesas, horarios, ubicación, disponibilidad por fecha y recomendaciones de ingreso.",
    tone: "Energético, claro y moderno.",
    welcomeMessage:
      "Hola, gracias por escribirnos. Puedo ayudarte con entradas, reservas, precios y horarios del evento. ¿Qué necesitás?",
    fallbackMessage:
      "Esa info no la tengo disponible todavía. Te paso con alguien del equipo.",
    handoffMessage: "Te conecto con alguien para darte más info.",
    faqs: [
      "¿Cuánto salen las entradas?",
      "¿Hay sector VIP?",
      "¿Cómo reservo una mesa?",
      "¿Cuál es la dirección?",
      "¿A qué hora abre?",
      "¿Hay lista de invitados?",
      "¿Aceptan tarjeta en la entrada?",
      "¿Cuál es la edad mínima?",
      "¿Puedo hacer cumpleaños ahí?",
    ],
    suggestedCategories: [
      "Entradas generales",
      "Sector VIP",
      "Reservas de mesa",
      "Cumpleaños",
      "Eventos privados",
      "Lista de invitados",
    ],
    commercialIntents: [
      "entrada",
      "precio",
      "reservar",
      "mesa",
      "VIP",
      "lista",
      "cumpleaños",
      "disponibilidad",
    ],
    recommendedFields: [
      "Nombre y fecha del próximo evento",
      "Dirección y cómo llegar",
      "Precio de entradas por sector",
      "Horarios de apertura",
      "Edad mínima de ingreso (si aplica)",
      "Cómo reservar mesa o VIP",
      "Medios de pago en puerta",
    ],
  },
  // Coming soon
  {
    id: "gym",
    name: "Gimnasio",
    emoji: "💪",
    description: "Para gimnasios y estudios de entrenamiento.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
  {
    id: "clinic",
    name: "Clínica / consultorio",
    emoji: "🩺",
    description: "Para consultorios médicos, odontológicos o psicológicos.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
  {
    id: "real_estate",
    name: "Inmobiliaria",
    emoji: "🏠",
    description: "Para inmobiliarias y brokers de propiedades.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
  {
    id: "dealership",
    name: "Concesionaria / vehículos",
    emoji: "🚗",
    description: "Para concesionarias y negocios de venta de vehículos.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
  {
    id: "education",
    name: "Cursos / educación",
    emoji: "📚",
    description: "Para cursos online, academias e institutos educativos.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
  {
    id: "tech_support",
    name: "Servicio técnico",
    emoji: "🔧",
    description: "Para talleres y servicios técnicos de electrónica o electrodomésticos.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
  {
    id: "general",
    name: "Emprendimiento general",
    emoji: "🚀",
    description: "Para cualquier emprendimiento que no encaje en los rubros anteriores.",
    botGoal: "",
    tone: "",
    welcomeMessage: "",
    fallbackMessage: "",
    handoffMessage: "",
    faqs: [],
    suggestedCategories: [],
    commercialIntents: [],
    recommendedFields: [],
    comingSoon: true,
  },
];

export function getTemplateById(id: string): BusinessTemplate | undefined {
  return BUSINESS_TEMPLATES.find((t) => t.id === id);
}

export function buildExtraFromTemplate(template: BusinessTemplate): string {
  const lines: string[] = [];

  lines.push(`Tono de respuesta: ${template.tone}`);
  lines.push("");
  lines.push(`Mensaje de bienvenida sugerido: ${template.welcomeMessage}`);
  lines.push("");
  lines.push(`Cuando no sabés responder: ${template.fallbackMessage}`);
  lines.push("");
  lines.push(`Para derivar a un humano: ${template.handoffMessage}`);

  if (template.faqs.length > 0) {
    lines.push("");
    lines.push("Preguntas frecuentes que puede hacer el cliente:");
    for (const faq of template.faqs) {
      lines.push(`- ${faq}`);
    }
  }

  if (template.commercialIntents.length > 0) {
    lines.push("");
    lines.push(
      `Cuando el cliente mencione estas palabras, mostrar interés de compra: ${template.commercialIntents.join(", ")}.`
    );
  }

  if (template.recommendedFields.length > 0) {
    lines.push("");
    lines.push(
      "Completar estos datos para personalizar las respuestas (reemplazar [completar] con información real):"
    );
    for (const field of template.recommendedFields) {
      lines.push(`- ${field}: [completar]`);
    }
  }

  return lines.join("\n");
}
