DEV:
Nuke Database:
npx prisma migrate reset

Then rebuild:
npx prisma db push
npx prisma generate


PROD:
Stop the container:
docker rm -f gamegalaxy-db

Delete the Volume:
docker volume rm gamegalaxy_db_data