# TEN NOC - Enterprise Resource Planning (ERP)

Plataforma integral de gestión logística, monitoreo de redes y Centro de Operaciones (NOC) desarrollada a medida para proveedores de telecomunicaciones (ISP). 

El sistema optimiza el control de cuadrillas en campo, la gestión de inventario de fibra óptica y los tiempos de resolución de averías (SLA), asegurando un flujo de comunicación en tiempo real entre la oficina y los técnicos.

## Características Principales

*   **Gestión de Tickets y SLA:** Control del ciclo de vida de instalaciones (Altas), Averías y Bajas con temporizadores dinámicos, registro de horas de llegada/cierre y captura de evidencias fotográficas ultraligeras.
*   **Inventario OLT / NAP Inteligente:** Mapeo de cajas NAP y validación matemática de disponibilidad de puertos antes de asignar una instalación, evitando colisiones de red.
*   **Rastreo y Geolocalización (GIS):** Integración con Google Maps para ubicar cajas NAP, empalmes (mufas) y seguimiento de rutas de las cuadrillas.
*   **Control de Accesos por Roles:** Vistas dinámicas, filtros y bloqueo de módulos específicos para Administradores, Soporte NOC, Coordinadores Comerciales y Técnicos de Campo.
*   **Bandeja de Mensajería y Notificaciones Push:** Sistema de comunicaciones interno y alertas en tiempo real (vía OneSignal) para derivaciones entre áreas y gestión de cobranzas.
*   **Exportación y Reportes Ejecutivos:** Generación de dashboards estadísticos, reportes PDF y exportación limpia a Excel (Kardex de almacén y rendimiento de técnicos).

## Stack Tecnológico

*   **Frontend:** HTML5, CSS3 (Custom Properties, Flexbox/Grid, interfaces Glassmorphism), Vanilla JavaScript (ES6+).
*   **Backend & Base de Datos:** Firebase Firestore (Base de datos NoSQL en tiempo real).
*   **Almacenamiento:** Firebase Storage (Compresión de imágenes en cliente para ahorro de ancho de banda).
*   **Autenticación:** Firebase Auth con validación de dominios, roles y perfiles sincronizados.

## Módulo Gamificación: TEN Arcade

El sistema incluye una consola arcade integrada directamente en el DOM mediante HTML5 Canvas, diseñada sin dependencias externas, como herramienta para reducir el estrés del personal en oficina.
*   **Juegos:** *El Gusanito (Snake)*, *Flappy Michi* y *Técnico en Apuros*.
*   **Cloud Leaderboard:** Ranking global sincronizado en tiempo real mediante Firebase, actualizando el Top 3 de la empresa en vivo utilizando los datos del perfil y foto de cada empleado.

---
*Desarrollado por el equipo de Ingeniería TI - TEN Internet.*