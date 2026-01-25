DEV:
Update Migration File, IMPORTANT FIRST STEP!
npx prisma migrate dev --name ADD CHANGES HERE

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