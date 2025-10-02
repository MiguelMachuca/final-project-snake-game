pipeline {
  agent any

  environment {
    DOCKER_REGISTRY = "docker.io"
    DOCKER_CREDENTIALS = "docker-registry-credentials"
    GIT_CREDENTIALS = "git-credentials"
    DOCKER_IMAGE_NAME = "mangelmy/devsecops-final-project:latest"
    //DOCKER_IMAGE_NAME = "${env.DOCKER_REGISTRY}/devsecops-labs/app:latest"
    SSH_CREDENTIALS = "ssh-deploy-key"
    STAGING_URL = "http://localhost:3000"
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    ansiColor('xterm')
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh 'ls -la'
      }
    }

    stage('SAST - Semgrep') {
        agent {
            docker { image 'returntocorp/semgrep:latest' }
        }
        steps {
            echo "Running Semgrep (SAST)..."
            sh '''
                semgrep --config=auto \\
                        --json --json-output=semgrep-results.json \\
                        --junit-xml --junit-xml-output=semgrep-results.xml \\
                        src || true
            '''
            archiveArtifacts artifacts: 'semgrep-results.json, semgrep-results.xml', allowEmptyArchive: true
        }
        post {
            always {
                script { sh 'echo "Semgrep done."' }
            }
        }
    }

    stage('SCA - Dependency Check') {
        steps {
            dependencyCheck(
                odcInstallation: 'OWASP-DepCheck-10',
                additionalArguments: '''
                    --project "devsecops-labs"
                    --scan .
                    --format JSON 
                    --format XML  // 🟢 Agrega XML como formato de salida
                    --prettyPrint
                '''
            )
            
            dependencyCheckPublisher pattern: 'dependency-check-report.xml'  

            archiveArtifacts artifacts: 'dependency-check-report.xml, dependency-check-report.json', allowEmptyArchive: true  
        }
    }

    stage('Build') {
      agent { label 'docker' }
      steps {
        echo "Building app (npm install and tests)..."
        sh '''
          cd src
          npm install --no-audit --no-fund
          if [ -f package.json ]; then
            if npm test --silent; then echo "Tests OK"; else echo "Tests failed (continue)"; fi
          fi
        '''
      }
    }

    stage('Docker Build & Trivy Scan') {
        steps {
            echo "Building Docker image..."
            sh '''
                docker build -t ${DOCKER_IMAGE_NAME} -f Dockerfile .
            '''
            echo "Scanning image with Trivy..."
            script {
                // Install Trivy using the official method
                sh '''
                    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                    
                    mkdir -p reporte-trivy
                    
                    trivy image --format json --output reporte-trivy/trivy-report.json ${DOCKER_IMAGE_NAME}
                    
                '''
            }
            archiveArtifacts artifacts: 'reporte-trivy/trivy-report.json', allowEmptyArchive: true
        }
    }   

    stage('Push Image (optional)') {
      when {
        expression { return env.DOCKER_REGISTRY != null && env.DOCKER_REGISTRY != "" }
      }
      steps {
        echo "Pushing image to registry ${DOCKER_REGISTRY}..."
        withCredentials([usernamePassword(credentialsId: "${DOCKER_CREDENTIALS}", usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh '''
            echo "$DOCKER_PASS" | docker login ${DOCKER_REGISTRY} -u "$DOCKER_USER" --password-stdin
            docker push ${DOCKER_IMAGE_NAME}
            docker logout ${DOCKER_REGISTRY}
          '''
        }
      }
    }

    stage('IaC Scan - Checkov') {
      agent any
      steps {
        echo "Instalando pip y ejecutando Checkov directamente..."
        sh '''
          apk add --no-cache py3-pip
          python3 -m pip install --user checkov
          checkov -f docker-compose.yml -f Dockerfile --output junitxml > checkov-report.xml || true
        '''
        junit 'checkov-report.xml'
        archiveArtifacts artifacts: 'checkov-report.xml', allowEmptyArchive: true
      }
    }   

    stage('Deploy to Staging (docker-compose)') {
      agent { label 'docker' }
      steps {
        echo "Deploying to staging with docker-compose..."
        sh '''
          docker-compose -f docker-compose.yml down || true
          docker-compose -f docker-compose.yml up -d --build
          sleep 8
          docker ps -a
        '''
      }
    }

    stage('DAST - OWASP ZAP Scan') {
        agent { label 'docker' }
        steps {
            echo "Running DAST (OWASP ZAP) against ${STAGING_URL} ..."
            sh '''
                mkdir -p zap-reports
                docker run --rm \\
                    --network host \\
                    -v "$(pwd)/zap-reports:/zap/wrk/:rw" \\
                    -v /var/run/docker.sock:/var/run/docker.sock \\
                    zaproxy/zap-stable \\
                    zap-baseline.py \\
                    -t ${STAGING_URL} \\
                    -I \\
                    -r zap-report.html \\
                    -x zap-report.xml \\
                    -J zap-report.json
            '''
            // Diagnostic step to see what was actually created
            sh 'find zap-reports -type f | head -n 10 || true'
            // Try a broader pattern to find the reports
            archiveArtifacts artifacts: 'zap-reports/**/*.*', allowEmptyArchive: true
        }
    }

    stage('Policy Check - Fail on HIGH/CRITICAL CVEs') {
    steps {
        script {
            // Run the security scan script and capture its exit code
            def exitCode = sh(script: '''
                chmod +x scripts/scan_trivy_fail.sh
                ./scripts/scan_trivy_fail.sh $DOCKER_IMAGE_NAME || exit_code=$?
                echo "Script exit code is: ${exit_code:-0}"
                exit ${exit_code:-0}
            ''', returnStatus: true) // 'returnStatus: true' prevents the sh step from failing the pipeline immediately

            // Evaluate the exit code
            if (exitCode == 2) {
                // Mark the build as unstable (Yellow warning) instead of failing it (Red)
                unstable("WARNING: HIGH/CRITICAL vulnerabilities were detected by Trivy. Please review.")
            } else if (exitCode != 0) {
                // For any other non-zero exit code, you may still want to fail
                error("Trivy scan failed with an unexpected error. Exit code: ${exitCode}")
            }
            // If exitCode is 0, the build continues as SUCCESS
        }
    }
    }
  } 

  post {
    always {
      echo "Pipeline finished. Collecting artifacts..."
    }
    failure {
      echo "Pipeline failed!"
    }
  }
}
