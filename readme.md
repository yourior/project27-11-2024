installation requirement
- node
- minikube(to run k8s locally)
- docker(to prepare the container)

steps 
1. Build Docker Image
run "cd app"
run "docker build -t <your-dockerhub-username>/express-app:latest ." (also change it on express-deployment.yaml)
run "docker push <your-dockerhub-username>/express-app:latest"

2. run minikube start
3. Apply Kubernetes Configurations
run "cd .."
run "kubectl apply -f k8s/mongodb-deployment.yaml"
run "kubectl apply -f k8s/redis-deployment.yaml"
run "kubectl apply -f k8s/rabbitmq-deployment.yaml"
run "kubectl apply -f k8s/express-deployment.yaml"

4. Verify Deployments
run "kubectl get pods"
run "kubectl get services"

5. run service (and get ip location of server.js running)
run "minikube service --all"


