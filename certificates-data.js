// certificates-data.js
// Loads certificates from JSON file using fetch (browser-compatible)

let CERTIFICATES_DATABASE = null;
let loadPromise = null;

export async function loadCertificates() {
  // Return cached data if already loaded
  if (CERTIFICATES_DATABASE) {
    return CERTIFICATES_DATABASE;
  }
  
  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise;
  }
  
  // Load certificates from JSON file
  // Uses import.meta.url to find the file relative to THIS script, not the HTML page
  loadPromise = fetch(new URL('./Certificates.json', import.meta.url))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load certificates: ${response.statusText}`);
      }
      return response.json();
    })
    .then((certificatesJson) => {
      CERTIFICATES_DATABASE = certificatesJson.map((cert, index) => ({
        id: `cert_${index + 1}_${(cert.Certificate_Name_EN || "")
          .replace(/\s+/g, "_")
          .toLowerCase()
          .slice(0, 30)}`,
        name: (cert.Certificate_Name_EN || "").trim(),
        nameAr: (cert.Certificate_Name_AR || "").trim(),
        entity: (cert.Certificate_Entity || "").trim(),
        fieldEn: (cert.Certificate_Field_EN || "").trim(),
        fieldAr: (cert.Certificate_Field_AR || "").trim(),
        description: (cert.Description || "").trim(),
        level: (cert.Level || "").trim()
      }));
      return CERTIFICATES_DATABASE;
    })
    .catch((err) => {
      console.error("Error loading certificates:", err);
      loadPromise = null; // Reset promise on error so we can retry
      return [];
    });
  
  return loadPromise;
}

// Export getter that ensures certificates are loaded
export function getCertificatesDatabase() {
  return CERTIFICATES_DATABASE || [];
}
