# Déploiement Railway sans Docker

## Configuration requise

### Variables d'environnement à configurer dans Railway :

1. **Base de données PostgreSQL** :
   - `DATABASE_URL` : URL de connexion PostgreSQL (fournie automatiquement par Railway)

2. **Configuration JWT** :
   - `SECRET_KEY` : Clé secrète pour signer les tokens JWT
   - `ALGORITHM` : Algorithme de signature (HS256)
   - `ACCESS_TOKEN_EXPIRE_MINUTES` : Durée de vie des tokens (30)

3. **Configuration email** :
   - `SMTP_HOST` : Serveur SMTP (ex: smtp.gmail.com)
   - `SMTP_PORT` : Port SMTP (587)
   - `SMTP_USER` : Email d'envoi
   - `SMTP_PASSWORD` : Mot de passe de l'application

4. **Configuration Railway** :
   - `PORT` : Port d'écoute (généré automatiquement)

5. **Configuration OpenAI (optionnel)** :
   - `OPENAI_API_KEY` : Clé API OpenAI pour les traductions

## Fichiers de configuration

- `Procfile` : Définit la commande de démarrage
- `runtime.txt` : Version de Python (3.10.18)
- `buildpack.sh` : Script d'installation des dépendances système
- `railway.json` : Configuration Railway avec Nixpacks
- `requirements.txt` : Dépendances Python

## Déploiement

1. Connectez votre repository GitHub à Railway
2. Configurez les variables d'environnement dans l'interface Railway
3. Le déploiement se fera automatiquement avec Nixpacks

## Notes importantes

- Le build peut prendre plusieurs minutes à cause de l'installation de PyTorch et Detectron2
- Assurez-vous que votre base de données PostgreSQL est configurée dans Railway
- Les fichiers de modèles AI doivent être présents dans le dossier `models_ai/` 