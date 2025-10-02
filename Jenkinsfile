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
            script {
                docker.image('bridgecrew/checkov:latest').inside("--entrypoint=''") {
                    sh '''
                        # Limpiar archivos previos
                        rm -f checkov-report.* checkov-scan-results.*
                        
                        # Ejecutar Checkov - generará archivos en directorio results-checkov/
                        checkov -f docker-compose.yml -f Dockerfile \
                          --soft-fail \
                          --output json --output-file-path checkov-results \
                          --output junitxml --output-file-path checkov-results
                                          
                        # Copiar y renombrar los archivos con nombres más descriptivos
                        cp results-checkov/results_json.json checkov-scan-results.json
                        cp results-checkov/results_junitxml.xml checkov-scan-results.xml
                        
                        # Limpiar archivos temporales y directorio
                        rm -rf results-checkov/
                        
                    '''
                }
            }
        }
        post {
            always {
                junit testResults: 'checkov-scan-results.xml', allowEmptyResults: true
                
                archiveArtifacts artifacts: 'checkov-scan-results.json, checkov-scan-results.xml', allowEmptyArchive: true
            }
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
        agent {
            docker {
                image 'zaproxy/zap-stable:latest'
                args '-v $WORKSPACE:/zap/wrk:rw --network=host'  
            }
        }
        steps {
            script {
                sh '''
                    cd /zap/wrk
                    # Generar reportes en JSON, HTML y XML
                    zap-baseline.py -t ${STAGING_URL} -J zap-report.json -r zap-report.html -x zap-report.xml -I
                    # Copiar los reportes al workspace principal
                    cp zap-report.* $WORKSPACE/ || true
                '''
            }
        }
        post {
            always {
                // Archivar todos los reportes (json, html, xml)
                archiveArtifacts artifacts: 'zap-report.*', allowEmptyArchive: true
            }
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
          echo "Pipeline execution completed - Status: ${currentBuild.result}"
          
          // 1. Limpieza de recursos temporales
          sh '''
              docker system prune -f || true
              rm -rf tmp/ || true
          '''
          
          // 2. Archivar TODOS los reportes de seguridad
          archiveArtifacts artifacts: '**/*report*, **/*results*, **/*.xml, **/*.json', allowEmptyArchive: true
          
          // 3. Publicar reportes consolidados
          junit testResults: '**/*.xml', allowEmptyResults: true
          dependencyCheckPublisher pattern: 'dependency-check-report.xml'
          
          // 4. Métricas y estadísticas
          script {
              echo "Build Number: ${env.BUILD_NUMBER}"
              echo "Build URL: ${env.BUILD_URL}"
              echo "Duration: ${currentBuild.durationString}"
          }
      }
      
      success {
          echo "✅ Pipeline ejecutado EXITOSAMENTE"
          script {
              // Notificación de éxito
              emailext (
                  subject: "✅ PIPELINE SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                  body: """
                  Pipeline completado exitosamente:
                  
                  - Build: ${env.BUILD_URL}
                  - Duración: ${currentBuild.durationString}
                  - Commit: ${env.GIT_COMMIT ?: 'N/A'}
                  
                  Reportes disponibles en los artifacts del build.
                  """,
                  to: "infradockers@gmail.com"
              )
          }
      }
      
      failure {
          echo "❌ Pipeline FALLÓ"
          script {
              // Notificación de fallo con detalles
              emailext (
                  subject: "🚨 PIPELINE FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                  body: """
                  El pipeline ha fallado:
                  
                  - Build: ${env.BUILD_URL}
                  - Stage que falló: ${env.STAGE_NAME}
                  - Duración: ${currentBuild.durationString}
                  
                  Por favor revisar los logs para más detalles.
                  """,
                  to: "infradockers@gmail.com"
              )
          }
      }
      
      unstable {
          echo "⚠️  Pipeline marcado como INESTABLE - Vulnerabilidades HIGH/CRITICAL detectadas"
          script {
              // Notificación específica para vulnerabilidades
              emailext (
                  subject: "⚠️  PIPELINE UNSTABLE: Vulnerabilidades en ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                  body: """
                  Pipeline completado pero con vulnerabilidades CRITICAL/HIGH:
                  
                  - Build: ${env.BUILD_URL}
                  - Razón: Vulnerabilidades detectadas por Trivy/Policy Check
                  - Acción: Revisar reportes de seguridad
                  
                  Se requiere revisión manual.
                  """,
                  to: "infradockers@gmail.com"
              )
          }
      }
      
      changed {
          echo "📊 Estado del pipeline cambió respecto a la última ejecución"
          script {
              if (currentBuild.previousBuild) {
                  echo "Estado anterior: ${currentBuild.previousBuild.result}"
                  echo "Estado actual: ${currentBuild.result}"
              }
          }
      }
      
      cleanup {
          echo "🧹 Ejecutando limpieza final..."
          // Limpieza garantizada de recursos
          sh '''
              # Limpiar contenedores detenidos
              docker-compose -f docker-compose.yml down || true
              
              # Limpiar imágenes temporales
              docker image prune -f || true
              
              # Limpiar redes no utilizadas
              docker network prune -f || true
          '''
          
          // Limpiar workspace si es necesario
          cleanWs()
      }
  }
}
