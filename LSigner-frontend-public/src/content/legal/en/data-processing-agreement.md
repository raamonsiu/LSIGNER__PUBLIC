# Data Processing Agreement (DPA)

**Last updated:** Saturday, July 4, 2026

## 0. Note on the scope of application

This Data Processing Agreement ("DPA") applies to the **business accounts (B2B)** of the LSigner Platform, thru which a company manages the sending of documents to be signed to its own employes or collaborators via a specific administration panel. This DPA is automatically incorporated, as a binding annex, to the service contract signed between LSigner and the client company at the moment the latter activates a business plan.

## 1. Parts

- **The Data Controller:** the client company that contracts the LSigner business plan (hereinafter, "the Client"), identified by the data provided during the contracting process.
- **The Data Processor:** LSigner, S.L., with NIF B12345678 and address at Carrer de Maria Aurèlia Capmany i Farnés, 67, 17006, Girona, Spain (hereinafter, "LSigner").

## 2. Object

This DPA regulates the processing of personal data that LSigner carries out on behalf of the Client, in its capacity as a data processor, within the framework of providing electronic signature services to the Client's employes or collaborators, in compliance with Article 28 of the GDPR.

## 3. Description of the treatment

- **Nature of the processing:** hosting, management, sending, signing, and custody of electronic documents, along with the generation of technical evidence of said signature.
- **Purpose:** to allow the Client to send documents to their employes or collaborators thru the Platform, and for them to sign them electronically, with a record of the operation being kept.
- **Categories of interested parties:** employes, collaborators, or any other natural person designated by the Client as the recipient of documents to be signed within their business account.
- **Categories of data processed:** name, email, and, where applicable, phone number of employees/collaborators; content of the documents sent by the Client for signature; associated signature evidence (IP address, user-agent, timestamps, OTP verification result, cryptographic evidence), as described in the [Electronic Signature Policy](/legal/electronic-signature-policy).
- **Duration of processing:** while the Client maintains their business plan active, and during the applicable retention period for the documents and signature evidence, in accordance with the [Document Retention and Custody Policy](/legal/document-retention-policy).

## 4. Scope of business accounts

Business accounts operate under a differentiated role system:

- Users with the **administrator** role (designated by the Client) can send documents for signature to employees/collaborators of their own organization and check the status of these documents and signatures from an administration panel.
- Users with the role of **employee/collaborator** can sign the documents sent to them by their organization, but they cannot use the Platform to send or sign documents with third parties external to that organization.

This segmentation implies that the data managed within a business account is limited to the internal scope of the Client's organization, without mixing with the use that other Users (individuals or other client companies) may make of the Platform independently.

## 5. Obligations of LSigner as Data Processor

LSigner commits to:

a) Process personal data only in accordance with the Client's documented instructions, including those related to international transfers, unless required to do so by Union or Member State law, in which case the Client will be informed of that legal requirement in advance, unless prohibited by law.

b) Ensure that the individuals authorized to process the data have committed to respecting confidentiality or are subject to a confidentiality obligation of a legal or contractual nature.

c) Adopt the technical and organizational security measures described in the [Privacy Policy](/legal/privacy-policy) and the Electronic Signature Policy, in accordance with Article 32 of the GDPR.

d) Respect the conditions established in this DPA to engage another data processor (sub-processor), in accordance with section 6.

e) Assist the Client, within reasonable limits and considering the nature of the processing, thru appropriate technical and organizational measures, to fulfilll their obligation to respond to requests for the exercise of rights by data subjects.

f) Assist the Client in ensuring compliance with the obligations established in Articles 32 to 36 of the GDPR (data processing security, notification of security breaches, impact assessments), taking into account the nature of the processing and the information available to LSigner.

g) At the Client's choice, upon the provision of the processing service, and delete the existing copies, unless Union or Member State law requires their retention (for example, the retention period for signature evidence with probative value, indicated in the Retention Policy).

h) Provide the Client with all the necessary information to demonstrate compliance with the obligations established in Article 28 of the GDPR, and allow and contribute to the conduct of audits, including inspections, by the Client or another auditor authorized by the Client, in accordance with Section 8.

i) Inform the Client immediately if, in their opinion, any instruction infringes the GDPR or other data protection provisions.

## 6. Sub-processors

The Client generally authorizes LSigner to use the following subprocessors for the provision of the service, being informed of any changes with reasonable advance notice, so that the Client can object for justified reasons:

| Subcontractor                  | Function                                                                                  | Location                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Hostinger                      | Infrastructure hosting (PostgreSQL database and backups on S3)                            | France (EU)                                                                            |
| Dokploy                        | Orchestration and deployment of containers on the previous infrastructure                 | France (EU)                                                                            |
| Email delivery provider (SMTP) | Routing and delivery of emails, including those containing OTP codes generated by LSigner | United Kingdom (country with a current Adequacy Decision from the European Commission) |

LSigner will ensure that these subprocessors assume the same data protection obligations as those established in this DPA, thru the corresponding contracts, and will remain fully responsible to the Client for the compliance with these obligations by its subprocessors.

## 7. International Transfers

The only international transfer of personal data outside the European Economic Area within the scope of this processing is related to the routing of emails thru the SMTP provider based in the United Kingdom, a country covered by the European Commission's Adequacy Decision (renewed on December 19, 2025, valid until December 2031), so this transfer does not require additional guaranties.

## 8. Audits and inspections

The Client may request from LSigner, with reasonable advance notice and at reasonable intervals, information and documentation that allows verification of compliance with the obligations established in this DPA. LSigner may provide such information thru internal or third-party audit reports, when available, as an alternative to an on-site audit, unless the Client reasonably justifies the need for the latter.

## 9. Notification of security breaches

LSigner will notify the Client, without undue delay and no later than 48 hours after becoming aware of it, of any breach of the security of personal data processed under this DPA that may affect the Client's employees/associates, providing reasonably available information so that the Client can, in turn, fulfilll its notification obligations in accordance with Articles 33 and 34 of the GDPR.

## 10. Destination of the data upon contract termination

Upon termination of the contractual relationship with the Client (cancellation of the business plan), LSigner, at the Client's discretion, will delete or return the personal data of employees/collaborators, as well as the associated documents and evidence, unless they must be retained for the period indicated in the Document Retention and Custody Policy due to their evidentiary value and the applicable legal document retention obligations.

## 11. Responsibility

Each party shall be responsible for complying with its own obligations under the GDPR and this DPA. The Client, as the Data Controller, is responsible for the legality of the instructions given to LSigner and for having an adequate legal basis for processing the data of their employees/collaborators (for example, the execution of the employment relationship or the applicable legitimate interest).

## 12. Duration

This DPA will remain in effect as long as the Client maintains an active business plan on the Platform, and it will automatically terminate when that contractual relationship ends, without prejudice to the obligations of data retention or deletion that survive its termination in accordance with section 10.

## 13. Applicable legislation

This DPA is governed by Spanish law and the GDPR, and is subject to the same Courts and Tribunals indicated in the Terms and Conditions of the service.
