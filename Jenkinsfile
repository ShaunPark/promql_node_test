def version
def onPremAgentLabel = 'beesc_live'
def awsAgentLabel
if (env.BRANCH_NAME == 'develop') {
  awsAgentLabel='bee_stg'
} else if (env.BRANCH_NAME == 'master') {
  awsAgentLabel='bee_live'
}

pipeline {
  options { 
    disableConcurrentBuilds() 
  }

  environment {
    REGISTRY = "https://cart.lge.com"
    REGISTRY_DOMAIN = "cart.lge.com"
    REGISTRY_CREDENTIAL = 'cart.cert'
    IMAGE_NAME = 'bee-node-mon-prometheus'
    BEE_STG_CLUSTER = 'arn:aws:eks:ap-northeast-2:883219384271:cluster/eks-an2-bee-stg'
    BEE_PROD_CLUSTER = 'arn:aws:eks:ap-northeast-2:883219384271:cluster/eks-an2-bee-prod'
    BEE_ONPREM_CLUSTER = 'kubernetes-admin@kubernetes'
    BEE_STG_NAMESPACE = 'monitoring'
    BEE_LIVE_NAMESPACE = 'monitoring'
    BEE_DEPLOY_NAME = 'bee-node-mon-prometheus'
    EMAIL_TO = 'chuloh.shin@lge.com, hyungsun.lim@lge.com, songhui.ryu@lge.com, jiwoong.baek@lge.com'
    DOCKERFILE = 'Dockerfile'
  }

  agent none

  stages {
    stage('Node info - AWS') {
      agent { label (awsAgentLabel)}
      steps {
        echo '===Node Info==='
        sh 'pwd'
        sh 'whoami'
        sh 'ifconfig'
      }
    }

    stage('Build image') {
      agent { label (awsAgentLabel)}
      steps {
          script {
          version = sh(script:"cat VERSION.txt | grep version | tr -d ' ' |cut -d'=' -f2", returnStdout: true).trim()
          echo "${version}"
          if (env.BRANCH_NAME == 'develop') {
            webDockerImage = docker.build("bee_docker/${IMAGE_NAME}:${version}-develop", "-f ${DOCKERFILE} .")
          }else if (env.BRANCH_NAME == 'master') {
            webDockerImage = docker.build("bee_docker/${IMAGE_NAME}:${version}", "-f ${DOCKERFILE} .")
          }
        }
      }
    }

    stage('Push image') {
      agent { label (awsAgentLabel)}
      steps {
        script {
          docker.withRegistry(REGISTRY, REGISTRY_CREDENTIAL) {
            webDockerImage.push()
          }
        }
      }
    }
  }
	
  post {
    success {
      emailext body: 'Check console output at $BUILD_URL to view the results.',
      to: "${EMAIL_TO}",
      subject: 'Jenkins build is success: $PROJECT_NAME - #$BUILD_NUMBER'
      slackSend (channel:"#bee-dev" , color: '#00FF00', message: "SUCCESSFUL: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
    }
    failure {
      emailext body: 'Check console output at $BUILD_URL to view the results. \n\n ${CHANGES} \n\n -------------------------------------------------- \n${BUILD_LOG, maxLines=100, escapeHtml=false}',
      to: "${EMAIL_TO}",
      subject: 'Build failed in Jenkins: $PROJECT_NAME - #$BUILD_NUMBER'
      slackSend (channel: '#bee-dev', color: '#FF0000', message: "FAILED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
    }
    unstable {
      emailext body: 'Check console output at $BUILD_URL to view the results. \n\n ${CHANGES} \n\n -------------------------------------------------- \n${BUILD_LOG, maxLines=100, escapeHtml=false}',
      to: "${EMAIL_TO}",
      subject: 'Unstable build in Jenkins: $PROJECT_NAME - #$BUILD_NUMBER'
      slackSend (channel: '#bee-dev', color: '#FF0000', message: "Unstable build in Jenkins: '${env.JOB_NAME} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
    }
    changed {
      emailext body: 'Check console output at $BUILD_URL to view the results.',
      to: "${EMAIL_TO}",
      subject: 'Jenkins build is back to normal: $PROJECT_NAME - #$BUILD_NUMBER'
      slackSend (channel: '#bee-dev', color: '#FF0000', message: "Jenkins build is back to normal: '${env.JOB_NAME} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
    }
  }
}